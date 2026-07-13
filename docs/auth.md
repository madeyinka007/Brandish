# Authentication and roles

Authentication is handled by **NextAuth.js** using the credentials provider. The session
token is a signed JWT stored as an `httpOnly`, `Secure`, `SameSite=lax` cookie. The `role`
field is embedded in the JWT payload so every API call can enforce permissions without a
database lookup.

---

## Roles

| Role | Permissions |
|---|---|
| `super-admin` | Full access — all collections, all users, settings, analytics |
| `editor` | Create/edit any post, moderate any comment, manage categories, send newsletter |
| `author` | Create/edit own posts only; cannot publish — requires editor approval |

Role is stored in `users.role` and embedded in the JWT at sign-in. If a user's role
changes, they must sign out and back in for the new role to take effect — the JWT is
only re-issued on sign-in.

> **Open question:** this table and `docs/development.md`'s authorId-scoping snippet both
> imply `author` can hit post endpoints scoped to their own posts, but
> `docs/api-routes.md`'s admin-posts table lists **Min role: editor** for every
> `/api/admin/posts*` route — which would exclude `author` entirely. `server/routes/admin/posts.ts`
> currently implements the table literally (`requireRole('editor', 'super-admin')`, no
> author access). Resolving this — e.g. adding a scoped `author` path, or a review-queue
> status — needs a deliberate decision, not an assumption baked in silently.

---

## NextAuth config

`users` is a Mongoose-backed collection (see the ODM split in
[`docs/data-model.md`](data-model.md#odm-strategy)), so `authorize()` queries through the
`User` Mongoose model rather than `getDb()`. Session/JWT fields (`userId`, `role`,
`avatar`) are declared via module augmentation in `types/next-auth.d.ts`, which is why the
callbacks below don't need `as any` casts.

```ts
// web/lib/auth.ts
import NextAuth, { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { dbConnect } from '@/lib/mongoose';
import User from '@/lib/models/User';

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email:    { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        await dbConnect();
        const user = await User.findOne(
          { email: credentials?.email, active: true },
          { passwordHash: 1, name: 1, email: 1, role: 1, avatar: 1 }
        );
        if (!user) return null;
        const valid = await bcrypt.compare(credentials!.password, user.passwordHash);
        if (!valid) return null;
        return {
          id:     user._id.toString(),
          name:   user.name,
          email:  user.email,
          role:   user.role,
          avatar: user.avatar,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role   = user.role;
        token.avatar = user.avatar;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.userId = token.userId;
      session.user.role   = token.role;
      session.user.avatar = token.avatar;
      return session;
    },
  },
  pages: { signIn: '/admin/login' },
};

export default NextAuth(authOptions);
```

**`web/app/api/auth/[...nextauth]/route.ts`** wires this into Next.js's App Router — it's the
one Next.js-hosted API route in the project (everything else is the Express API):

```ts
import handler from '@/lib/auth';

export { handler as GET, handler as POST };
```

---

## API middleware

These middleware functions are used in the Express API (Lambda).

### `requireAuth` — verify JWT on every admin request

```ts
// server/middleware/auth.ts
import { getToken } from 'next-auth/jwt';
import type { Request, Response, NextFunction } from 'express';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = await getToken({ req, secret: process.env.JWT_SECRET! });
  if (!token) return res.status(401).json({ error: 'Unauthorized', code: 'NO_SESSION' });
  if (!(token as any).userId) return res.status(401).json({ error: 'Invalid session' });
  (req as any).user = token;
  next();
}
```

### `requireRole` — enforce minimum role

```ts
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as any).user?.role;
    if (!roles.includes(userRole)) {
      return res.status(403).json({ error: 'Forbidden', code: 'INSUFFICIENT_ROLE' });
    }
    next();
  };
}
```

**Usage:**
```ts
// editor or super-admin can publish posts
router.put('/posts/:id', requireAuth, requireRole('editor', 'super-admin'), updatePost);

// only super-admin can manage users
router.delete('/users/:id', requireAuth, requireRole('super-admin'), deleteUser);
```

### `recaptcha` — validate reCAPTCHA v3 token

```ts
// server/middleware/recaptcha.ts
export async function validateRecaptcha(req: Request, res: Response, next: NextFunction) {
  const { recaptchaToken } = req.body;
  if (!recaptchaToken) return res.status(400).json({ error: 'reCAPTCHA token required' });

  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${process.env.RECAPTCHA_SECRET}&response=${recaptchaToken}`,
  });
  const data = await response.json();

  if (!data.success || data.score < 0.5) {
    // Silent discard — do not expose detection logic to bots
    return res.status(200).json({ message: 'Comment received' });
  }
  next();
}
```

---

## Protecting Next.js admin pages

Use NextAuth's `getServerSession` in server components to gate the `/admin` tree.

**Important:** the gate layout must **not** sit directly at `web/app/admin/layout.tsx`,
because that would also wrap `web/app/admin/login/page.tsx` (a sibling route under the same
parent) — an unauthenticated visit to `/admin/login` would redirect to `/admin/login`,
which re-runs the same layout, which redirects again: an infinite loop. Instead, every
gated page lives under the `web/app/admin/(dashboard)/` route group, and the gate layout sits
inside that group. Route groups (`(name)`) don't add a URL segment, so `/admin`,
`/admin/posts`, etc. are unaffected — only `/admin/login`, a sibling outside the group, is
exempt from the gate.

```ts
// web/app/admin/(dashboard)/layout.tsx
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/admin/login');
  return <>{children}</>;
}
```

For role-specific pages (e.g. user management):
```ts
const session = await getServerSession(authOptions);
if (session?.user?.role !== 'super-admin') redirect('/admin');
```

---

## Password hashing

Always use `bcryptjs` with a cost factor of `10`.

```ts
import bcrypt from 'bcryptjs';

// On user creation
const passwordHash = await bcrypt.hash(plainPassword, 10);
await db.collection('users').insertOne({ ...userData, passwordHash });

// On login — handled in NextAuth authorize() above
const valid = await bcrypt.compare(plainPassword, storedHash);
```

Never log, return, or transmit `passwordHash`. Project it out of every query with
`{ projection: { passwordHash: 0 } }` unless you are explicitly comparing it (login only).
