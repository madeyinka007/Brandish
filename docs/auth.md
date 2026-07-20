# Authentication and roles

> **Architecture note (supersedes NextAuth).** Authentication is owned by the Express API
> as a self-contained JWT system (`server/services/auth.ts` and friends), **not** NextAuth.
> The API issues its own short-lived **access tokens** (Bearer, 15 min) and rotating
> **refresh tokens** (opaque, 7 days, stored in DynamoDB). The `role` claim is embedded in
> the access token so every request enforces permissions without a database lookup.
>
> The frontend consumes these endpoints directly: the admin UI (`web/app/admin/`) calls
> `/api/auth/login`, stores the returned tokens client-side, and gates `/admin` on the access
> token (see "Protecting Next.js admin pages" below). NextAuth is no longer used.

Clients send the access token as `Authorization: Bearer <token>` on every request;
`requireAuth` verifies it. When it expires, `POST /api/auth/refresh` exchanges a valid
refresh token for a new access + refresh pair (rotation — the old refresh token is
invalidated). See [`docs/api-routes.md`](api-routes.md) for the full route list and
[`docs/openapi-auth.yaml`](openapi-auth.yaml) for the request/response schemas.

---

## Roles

| Role | Permissions |
|---|---|
| `super-admin` | Full access — all collections, all users, settings, analytics |
| `editor` | Create/edit any post, moderate any comment, manage categories, send newsletter |
| `author` | Create/edit own posts only; cannot publish — requires editor approval |
| `reader` | Authenticated end-user with **no** admin/editorial access. Added to `users.role` in `docs/data-model.md`. |

> **`reader` — permissions not yet fully specified.** The role exists in the schema and the
> `User` model's enum (so users can be created/assigned as `reader`), but no route currently
> grants it anything an anonymous visitor doesn't already have — every `/api/admin/*` route
> requires `editor`+ or `super-admin`. Treat `reader` as "logged-in, but unprivileged" until
> a feature (e.g. gated content, member comments) actually defines what it unlocks. Don't
> infer capabilities for it silently.

Role is stored in `users.role` and embedded in each **access token** when it's issued
(login or refresh). A role change therefore takes effect at most one access-token lifetime
(15 min) later — on the next refresh — without forcing a re-login, since every refresh
re-reads the user and re-embeds the current role. (Access tokens themselves are never
mutated mid-life; they're just short.)

> **Open question:** this table and `docs/development.md`'s authorId-scoping snippet both
> imply `author` can hit post endpoints scoped to their own posts, but
> `docs/api-routes.md`'s admin-posts table lists **Min role: editor** for every
> `/api/admin/posts*` route — which would exclude `author` entirely. `server/routes/admin/posts.ts`
> currently implements the table literally (`requireRole('editor', 'super-admin')`, no
> author access). Resolving this — e.g. adding a scoped `author` path, or a review-queue
> status — needs a deliberate decision, not an assumption baked in silently.

---

## Module layout

The auth module follows the standard routes → controllers → services → domain-model
layering (see [`docs/development.md`](development.md)):

| File | Responsibility |
|---|---|
| `server/routes/auth.ts` | Wiring — mounts each endpoint under `/api/auth` |
| `server/controllers/auth.ts` | Orchestration — reads `req`, calls one service fn, shapes the response |
| `server/services/auth.ts` | All auth business logic (the flows below) |
| `server/lib/models/User.ts` | `UserModel extends BaseModel<UserDoc>` + `sanitizeUser()` |
| `server/lib/jwt.ts` | `signAccessToken` / `verifyAccessToken` (wraps `jsonwebtoken`) |
| `server/lib/password.ts` | `hashPassword` / `comparePassword` (bcrypt, cost 10) |
| `server/lib/validation.ts` | Pure validators (`isEmail`, `isStrongPassword`, …) — no dependency added |
| `server/lib/dynamo.ts` | Refresh-token store (`storeRefreshToken` / `consumeRefreshToken` / `revokeRefreshToken`) |
| `server/lib/ses.ts` | `sendEmail` for reset / verification links |
| `server/lib/errors.ts` | `AppError` + `asyncHandler`; `server/middleware/errorHandler.ts` maps them to `{ error, code }` |

`users` is Mongoose-backed (see the ODM split in
[`docs/data-model.md`](data-model.md#odm-strategy)), so the service goes through
`getUserModel()` → `UserModel` (a `BaseModel` subclass) — never Mongoose directly.

## Token architecture

- **Access token** — a JWT signed with `JWT_SECRET`, 15-minute TTL, payload
  `{ userId, role, email }`. Sent as `Authorization: Bearer <token>`; verified statelessly
  by `requireAuth` and the Lambda authorizer. Not revocable (that's the deliberate tradeoff
  for statelessness — kept short to bound the exposure window).
- **Refresh token** — an opaque `crypto.randomBytes(40)` string, 7-day TTL, stored in the
  `refresh_tokens` DynamoDB table keyed by the token → `userId` (see
  [`docs/data-model.md`](data-model.md)). **Rotated on every use:** `POST /api/auth/refresh`
  atomically consumes (deletes) the presented token and issues a brand-new access + refresh
  pair. A token can be redeemed at most once; logout deletes it.

## Auth flows

All live in `server/services/auth.ts`. Errors are thrown as `AppError(status, code, msg)`
and rendered by the central error middleware into the standard `{ error, code }` shape.

| Flow | Route | Notes |
|---|---|---|
| Login | `POST /api/auth/login` | Verifies password (bcrypt); **one generic `401 INVALID_CREDENTIALS`** for unknown-user / inactive / wrong-password (no enumeration); `403 EMAIL_NOT_VERIFIED` if unverified; returns `{ accessToken, refreshToken, user }` (sanitized). |
| Refresh | `POST /api/auth/refresh` | Rotation (above). `401 INVALID_REFRESH_TOKEN` if unknown/consumed/expired or the user is now inactive. |
| Logout | `POST /api/auth/logout` | Revokes the given refresh token. Idempotent — no error if absent. |
| Forgot password | `POST /api/auth/forgot-password` | **Enumeration-safe: always `200`.** Only a real active account gets a reset email (token + 1h expiry on the user doc). |
| Reset password | `POST /api/auth/reset-password` | Consumes the reset token (must be unexpired), re-hashes, clears the token fields. `400` on invalid/expired/weak. |
| Change password | `POST /api/auth/change-password` | `requireAuth`. Verifies `currentPassword`; `401 INVALID_CURRENT_PASSWORD` on mismatch. |
| Verify email | `POST /api/auth/verify-email` | Consumes `emailVerificationToken` → sets `emailVerified: true`. Accepts the token in body or `?token=`. |
| Resend verification | `POST /api/auth/resend-verification` | **Enumeration-safe: always `200`.** Re-issues a verification token + email for an unverified account. |

> **Cross-module dependency (email verification) — RESOLVED by the Users module.**
> `server/services/users.ts` → `createUser()` now issues an `emailVerificationToken` and
> sends the initial verification email on create, so `verify-email` / `resend-verification`
> have a token to consume.
>
> **Bootstrap (first super-admin) — RESOLVED by a seed script.** The API can't create the
> first super-admin (every create route is super-admin-only), so
> `server/scripts/seedSuperAdmin.ts` (`npm run seed:admin`) inserts one directly with
> `emailVerified: true` and a bcrypt-hashed password. Idempotent. The default bootstrap
> credential (`admin@brandish.com.ng` / `Admin@2026`, overridable via `SEED_ADMIN_*` env)
> should be changed via `POST /api/auth/change-password` immediately after first login.

---

## API middleware

These middleware functions are used in the Express API (Lambda).

### `requireAuth` — verify the Bearer access token

```ts
// server/middleware/auth.ts
import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', code: 'NO_SESSION' });
  }
  try {
    const payload = verifyAccessToken(header.slice('Bearer '.length).trim());
    (req as any).user = payload; // { userId, role, email }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
  }
}
```

`NO_SESSION` means no usable Bearer header was presented; `INVALID_TOKEN` means one was but
it failed verification (bad signature, expired, malformed) — distinct codes so a client can
tell "log in" from "refresh your token" apart. The same token is validated at the edge by
the **Lambda authorizer** (`server/authorizer.ts`, HTTP API simple-response format) for
`/api/admin/*`; per-route role checks still happen in Express via `requireRole`.

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
  if (!recaptchaToken) {
    return res.status(400).json({ error: 'reCAPTCHA token required', code: 'MISSING_RECAPTCHA_TOKEN' });
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${process.env.RECAPTCHA_SECRET}&response=${recaptchaToken}`,
    });
    const data = await response.json();

    if (!data.success || data.score < 0.5) {
      // Silent discard — do not expose detection logic to bots
      return res.status(200).json({ message: 'Received' });
    }
  } catch {
    // Google unreachable, or its response didn't parse — fail the same way a low score
    // does. A 4xx/5xx here would be just as revealing to a bot as an honest rejection.
    return res.status(200).json({ message: 'Received' });
  }
  next();
}
```

A missing token is the one case that gets a real error response (`400`) — the caller
controls whether to send a token at all, so there's nothing to hide there. Everything
downstream of "a token was sent" (low score, or Google itself failing) must resolve to
the same disguised `200`, including the failure path, or an outage in Google's API would
leak detection logic exactly like an honest rejection would.

### `rateLimit` — per-IP request throttling via DynamoDB

```ts
// server/middleware/rateLimit.ts
import { checkRateLimit } from '../lib/dynamo';

function extractIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (Array.isArray(forwardedFor)) return forwardedFor[0];
  if (typeof forwardedFor === 'string') return forwardedFor.split(',')[0].trim();
  return req.ip ?? '';
}

export async function rateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = extractIp(req);
  const allowed = await checkRateLimit(ip);
  if (!allowed) {
    return res.status(429).json({ error: 'Too Many Requests', code: 'RATE_LIMITED' });
  }
  next();
}
```

Reads `x-forwarded-for` first, falling back to `req.ip` — API Gateway sets this header
reliably, and it can be a comma-separated list (client, proxy1, proxy2, ...) or a
repeated-header array, so the first entry is the one that matters. See
[`docs/data-model.md`](data-model.md) for the `ratelimit` table's atomic increment
pattern that `checkRateLimit` wraps.

---

## Protecting Next.js admin pages

The admin UI lives in `web/app/admin/` and gates itself against the **API-issued access
token** (no NextAuth). The structure:

- `web/app/admin/login/page.tsx` — the sign-in page; stays *outside* the gated route group so
  it isn't itself gated (which would cause a redirect loop). It calls `POST /api/auth/login`
  via `web/lib/auth.ts`, stores the returned `{ accessToken, refreshToken, user }`, and
  redirects to `/admin`.
- `web/app/admin/(dashboard)/layout.tsx` — the gate. A **client-side** check: if there's no
  stored access token it `router.replace('/admin/login')`, otherwise it renders the dashboard
  shell (sidebar + topbar + page). The `(dashboard)` route group adds no URL segment, so pages
  still serve at `/admin`, `/admin/posts`, etc.

This client gate is **UX only** — the real security boundary is the API: the Lambda authorizer
+ `requireRole` re-check the Bearer token and role on every `/api/admin/*` request, so a forged
or missing token fails server-side regardless of what the client renders. Admin pages fetch
through `web/lib/auth.ts`'s `authFetch`, which attaches `Authorization: Bearer <accessToken>`.

---

## Password hashing

Always use `bcryptjs` with a cost factor of `10`, via `server/lib/password.ts`
(`hashPassword` / `comparePassword`) rather than calling bcrypt inline.

```ts
import { hashPassword, comparePassword } from '../lib/password';

// On user creation (Users module) and password reset/change (auth module)
const passwordHash = await hashPassword(plainPassword);

// On login / change-password — compare against the stored hash
const valid = await comparePassword(plainPassword, user.passwordHash);
```

Never log, return, or transmit `passwordHash`. The auth module's `sanitizeUser()` strips it
(and the reset/verification tokens) from every user payload — see
[`docs/data-model.md`](data-model.md#users).
