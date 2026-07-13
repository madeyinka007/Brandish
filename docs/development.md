# Local development and conventions

---

## Local development setup

`web/` and `server/` are independent npm projects — install and run each from its own
directory.

```bash
# Frontend (Next.js) — run from web/
cd web
npm install
npm run dev                  # starts on port 3000

# API (Express) — run from server/, in a separate terminal
cd server
npm install
npm run dev                  # plain Node, not via Lambda — starts on port 3001

# Within either directory:
npm test
npm run lint
npm run typecheck
```

**`web/.env.local`:**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_RECAPTCHA_KEY=your_recaptcha_site_key
NEXTAUTH_SECRET=any_local_secret_32_chars_min
NEXTAUTH_URL=http://localhost:3000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/blog
CLOUDFRONT_DIST_ID=EXAMPLEID
S3_BUCKET_NAME=your-dev-bucket
CF_DOMAIN=d1abc.cloudfront.net
```

**`server/.env`:**
```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/blog
JWT_SECRET=same_as_NEXTAUTH_SECRET_above
RECAPTCHA_SECRET=your_recaptcha_secret_key
SES_FROM_EMAIL=dev@yourdomain.ng
ADMIN_ALERT_EMAIL=you@yourdomain.ng
CLOUDFRONT_DIST_ID=EXAMPLEID
S3_BUCKET_NAME=your-dev-bucket
CF_DOMAIN=d1abc.cloudfront.net
DYNAMO_DEDUP_TABLE=view_dedup
DYNAMO_RATELIMIT_TABLE=ratelimit
AWS_REGION=us-east-1
API_BASE_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
```

> **Use Atlas M0 for local development** — not a local mongod. Atlas connection
> behaviour (connection pooling, indexes, write concerns) differs from local MongoDB
> and issues surface earlier when using the real cluster.

---

## Unit testing

`web/` and `server/` each run **Jest** independently — same rule as everything else in
this split: no shared config, no shared `node_modules`. Both use `ts-jest` so tests run
directly against the TypeScript source, no separate build step.

**These are unit tests, not integration tests.** Nothing in a test talks to real MongoDB,
DynamoDB, S3, SES, or the reCAPTCHA API — every external client is mocked at the module
boundary with `jest.mock(...)`. If a test needs a real network call or a real database to
pass, it's testing the wrong thing at this layer.

**`server/jest.config.js`** (`web/jest.config.js` is the same, scoped to `web/`'s tree):
```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['routes/**/*.ts', 'middleware/**/*.ts', 'lib/**/*.ts'],
};
```

**`package.json` scripts** (both projects):
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

**Convention:** tests live in `__tests__/`, mirroring the source tree — e.g.
`server/lib/slug.ts` is tested by `server/__tests__/lib/slug.test.ts`. This matches the
existing `server/__tests__/` reference in "Adding a new API route" below.

**What's actually worth unit-testing here:**
- **Pure logic** — `slugify()`/`uniqueSlug()` in `lib/slug.ts`, `requireRole()`'s role
  check, the `validateImageUrl` SSRF guard (see [`docs/workflows.md`](workflows.md#media-upload-flow)) — these have no I/O of their own or take a mockable dependency, so they're the cheapest, highest-value tests.
- **Route handlers and middleware** — mock `req`/`res`/`next` directly (they're plain
  objects; no need for `supertest` or a running server) and mock whatever the handler
  calls (`Post.findOne`, `getDb()`, the S3/DynamoDB/SES clients) with `jest.mock(...)`.
- **NOT the connection helpers themselves** (`lib/mongodb.ts`, `lib/mongoose.ts`) — they're
  thin singleton wrappers around the driver with no branching logic of their own. Mock
  them at the call site in whatever consumes them instead of testing the wrapper directly.

**Example — testing `uniqueSlug()` with the `Post` model mocked:**
```ts
// server/__tests__/lib/slug.test.ts
jest.mock('../../lib/models/Post');
import Post from '../../lib/models/Post';
import { uniqueSlug } from '../../lib/slug';

test('appends a numeric suffix on collision', async () => {
  (Post.findOne as jest.Mock)
    .mockReturnValueOnce({ select: () => Promise.resolve({ _id: '1' }) })  // "my-post" taken
    .mockReturnValueOnce({ select: () => Promise.resolve(null) });          // "my-post-2" free

  await expect(uniqueSlug('My Post')).resolves.toBe('my-post-2');
});
```

---

## Slug generation

Auto-generate from title. Enforce uniqueness by appending a numeric suffix on collision.

`posts` is Mongoose-managed (see the [ODM split](data-model.md#odm-strategy)), so
`uniqueSlug()` checks uniqueness through the `Post` model rather than a raw `Db` handle —
no `db` parameter is needed, just `await dbConnect()` before calling it. Identical copy in
`web/lib/slug.ts` and `server/lib/slug.ts`, same convention as the connection helpers and models.

```ts
// web/lib/slug.ts  (identical copy in server/lib/slug.ts)
import Post from './models/Post';

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')     // remove non-alphanumeric except spaces and hyphens
    .replace(/\s+/g, '-')              // spaces → hyphens
    .replace(/-+/g, '-')               // collapse multiple hyphens
    .replace(/^-|-$/g, '');            // trim leading/trailing hyphens
}

export async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title);
  let slug = base;
  let suffix = 2;

  while (await Post.findOne({ slug }).select('_id')) {
    slug = `${base}-${suffix++}`;
  }
  return slug;
}
```

**Usage on post create:**
```ts
await dbConnect();
const slug = await uniqueSlug(post.title);
await Post.create({ ...post, slug });
```

---

## Key conventions

### Never do these

- **Return `users.passwordHash` in any API response.** Always project it out:
  `{ projection: { passwordHash: 0 } }`. Check every new users query.

- **Route media uploads through Lambda.** Lambda has a 6 MB invocation payload limit.
  Use S3 presigned URLs — the browser uploads directly to S3.

- **Store secrets in code or `.env` files committed to git.** All secrets belong in
  SSM Parameter Store. The `.env` files listed above are for local development only
  and must be in `.gitignore`.

- **Call `CloudFront.createInvalidation(['/*'])`.** Always target specific paths
  (`/category/slug`, `/category`). A wildcard invalidation is expensive and slow.

- **Use `findOne` then save for `viewCount`.** This is a read-modify-write race condition.
  Always use `$inc`: `updateOne({ _id }, { $inc: { viewCount: 1 } })`.

- **Display raw S3 URLs.** For `media.source: 'upload'`, store and serve only CloudFront
  URLs in `media.url` and `posts.coverImage`. The S3 bucket is private; direct S3 URLs
  return 403. (This doesn't apply to `media.source: 'url'` — those are external URLs by
  design, see [`docs/data-model.md`](data-model.md).)

- **Fetch a `media.source: 'url'` link server-side without an SSRF guard.** Validating
  that a pasted URL is a real, reachable image means the API makes an outbound request to
  a user-supplied address — reject non-http(s) protocols and private/loopback/link-local
  IP ranges before that request, or the Lambda becomes a proxy onto the internal network
  (e.g. the metadata service). See [`docs/workflows.md`](workflows.md#media-upload-flow).

- **Hard-delete subscribers.** Set `active: false` instead. Keeps the audit trail and
  prevents re-subscription emails if the same address subscribes again.

- **Mix ODM access patterns for one collection.** `users`, `posts`, `categories`, `tags`,
  `comments`, and `subscribers` are Mongoose-only (`web/lib/models/*.ts`, duplicated in
  `server/lib/models/*.ts`). `media`,
  `page_views`, `analytics`, `search_logs`, `audit_log`, and `notifications` are
  native-driver-only (`getDb()`). Querying a Mongoose collection with the raw driver (or
  vice versa) skips schema validation and defaults — see
  [`docs/data-model.md`](data-model.md#odm-strategy) for the full split.

### Always do these

- **Validate reCAPTCHA server-side** before any public write (comments, newsletter).
  Never trust a client-side score claim.

- **Use `attribute_not_exists(pk)` in DynamoDB** for view dedup. A `GetItem` + `PutItem`
  pair has a race condition. The conditional write is atomic.

- **Strip HTML from `comments.body`** before storing. Use `sanitize-html` with an empty
  allowlist. Display and store plain text only.

- **Embed `author.{name, avatar}` in posts at write time.** Denormalising avoids a
  join on every post read. Update embedded author data if the user changes their name
  (batch update with `updateMany({ 'author._id': userId }, { $set: { 'author.name': newName } })`).

- **Set `Cache-Control: public, max-age=0, must-revalidate`** on all HTML objects
  uploaded to S3. This ensures CloudFront always revalidates with the origin after a
  cache invalidation, rather than serving a stale cached copy.

- **Scope data by `authorId` for authors.** Authors can only read and write their own
  posts. Enforce this in the API query, not just in the UI:
  ```ts
  const filter = role === 'author' ? { 'author._id': new ObjectId(userId) } : {};
  db.collection('posts').find(filter);
  ```

- **Generate slugs server-side.** Do not trust client-submitted slugs. Always
  generate from `title` using `uniqueSlug()` on create. Allow editing on update
  but re-validate uniqueness.

- **Use `new ObjectId(id)` when querying by `_id`.** MongoDB Atlas requires `ObjectId`
  type for `_id` comparisons. String comparisons silently return no results.
  Wrap with a try/catch to handle invalid ObjectId strings gracefully:
  ```ts
  import { ObjectId } from 'mongodb';
  try {
    const oid = new ObjectId(req.params.id);
  } catch {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  ```

- **Call `dbConnect()` before using any Mongoose model.** Unlike `getDb()`, a Mongoose
  model can be imported and referenced before the connection resolves; querying too early
  queues operations silently instead of failing fast. Always `await dbConnect()` from
  `web/lib/mongoose.ts` (or `server/lib/mongoose.ts`) first:
  ```ts
  import { dbConnect } from '../lib/mongoose';
  import Post from '../lib/models/Post';

  await dbConnect();
  const post = await Post.findOne({ slug, status: 'published' });
  ```

---

## Adding a new API route

1. Create the handler file in `server/routes/` (or `server/routes/admin/` for protected routes)
2. Add `requireAuth` and `requireRole(...)` middleware for protected routes
3. Register the router in `server/index.ts`
4. Add the route to `docs/api-routes.md`
5. Add any new MongoDB indexes to `docs/data-model.md`
6. Write a test in `server/__tests__/`

## Adding a new Mongoose model

1. Decide whether the collection belongs on Mongoose or the native driver — see the
   ODM split in [`docs/data-model.md`](data-model.md#odm-strategy). Only add a Mongoose
   model if the collection needs schema validation/defaults on write.
2. Create the schema in `web/lib/models/<Name>.ts` using `InferSchemaType` for the document
   type (no cross-project type imports — keep the file self-contained)
3. Copy the file **identically** to `server/lib/models/<Name>.ts`
4. Add the collection's schema, indexes, and Mongoose-model note to `docs/data-model.md`
5. Add the corresponding TypeScript interface to `web/types/index.ts` (and its identical
   copy at `server/types/index.ts`) if the shape is also needed outside Mongoose (e.g. in
   a Next.js server component prop)

## Adding a new admin panel page

1. Create `web/app/admin/(dashboard)/[section]/page.tsx` — **not** directly under
   `web/app/admin/`. The `(dashboard)` route group is where the session gate
   (`layout.tsx`) lives; it's a sibling of `web/app/admin/login/page.tsx`, which must
   stay ungated to avoid a redirect loop. Route groups don't add a URL segment, so this
   still serves `/admin/[section]`.
2. Use `getServerSession` to verify role — redirect to `/admin` if insufficient
3. Add the section to the sidebar nav in `web/app/admin/(dashboard)/layout.tsx`
4. Add the corresponding admin API route (see above)
