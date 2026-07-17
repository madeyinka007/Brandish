# API routes

The API is an Express app deployed as a single AWS Lambda function behind API Gateway HTTP API.
All routes are prefixed `/api/`. Admin routes require a valid JWT — the API Gateway Lambda
Authorizer rejects unauthenticated requests before the Express handler runs.

See [`docs/auth.md`](auth.md) for the middleware implementation.

**Global Rules Before generating any endpoints, establish rules Claude must follow throughout the project:**
Architecture rules:

* Never use Mongoose directly inside controllers, services, or routes.
* All database access must go through the existing Mongo library via the BaseModel.
* Every domain model extends BaseModel.
* Controllers should only orchestrate requests and responses.
* Business logic belongs in services.
* Validate all request payloads.
* Return standardized API responses.
* Use async/await.
* Use dependency injection where appropriate.
* Follow SOLID principles.
* Generate production-ready TypeScript.
* Include OpenAPI documentation where applicable.
* Write unit tests for controllers and services.
* Never duplicate logic already provided by BaseModel or the Mongo library.

**Calling admin routes from the admin panel:** always use a relative path (e.g.
`fetch('/api/admin/posts/:id')`), never the absolute `NEXT_PUBLIC_API_URL`. The NextAuth
session cookie is `SameSite=Lax`, so a browser `fetch()` straight to the cross-origin API
Gateway URL never carries it. `next.config.js` rewrites `/api/:path*` to
`NEXT_PUBLIC_API_URL` server-side — Next.js's own `web/app/api/auth/[...nextauth]` route still
wins first as a real filesystem route — so the browser only ever talks to its own origin,
and Next.js forwards the request (cookies included) to the Express API on the server side,
where browser SameSite rules don't apply. Public (unauthenticated) routes like
`POST /api/comments` don't have this problem and can use either form.

---

## Authentication routes — `/api/auth`

The API owns authentication (custom JWT + rotating refresh tokens, **not** NextAuth) —
see [`docs/auth.md`](auth.md) and [`docs/openapi-auth.yaml`](openapi-auth.yaml). All of
these are unauthenticated except `change-password` (needs a valid access token).

| Method | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | — | Email + password → `{ accessToken, refreshToken, user }`. Generic `401` on bad creds; `403 EMAIL_NOT_VERIFIED` if unverified. |
| `POST` | `/api/auth/refresh` | — | Exchange a refresh token for a new pair (rotation — old token invalidated). |
| `POST` | `/api/auth/logout` | — | Revoke the given refresh token (idempotent). |
| `POST` | `/api/auth/forgot-password` | — | Send a reset email. Enumeration-safe — always `200`. |
| `POST` | `/api/auth/reset-password` | — | Reset password via reset token. |
| `POST` | `/api/auth/change-password` | Bearer | Change password (verifies current). |
| `POST` | `/api/auth/verify-email` | — | Verify email via token (body or `?token=`). |
| `POST` | `/api/auth/resend-verification` | — | Re-send verification email. Enumeration-safe — always `200`. |

Authenticated requests send `Authorization: Bearer <accessToken>`; `requireAuth` validates
it (`401 NO_SESSION` if absent, `401 INVALID_TOKEN` if invalid/expired).

---

## Public routes — no authentication required

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/posts` | List published posts. Query params: `?category=&page=&limit=` |
| `GET` | `/api/posts/:slug` | Single post by slug |
| `GET` | `/api/comments?postId=` | Approved comments for a post. Always filters `status: "approved"` |
| `POST` | `/api/comments` | Submit comment — reCAPTCHA v3 validation + IP rate limit enforced before write |
| `POST` | `/api/views/:id` | Increment view count — DynamoDB conditional write deduplicates per IP per 24h |
| `POST` | `/api/newsletter` | Subscribe — saves unconfirmed subscriber, sends SES confirmation email |
| `GET` | `/api/newsletter/confirm?token=` | Confirm subscription — sets `confirmedAt`, clears token |
| `GET` | `/api/newsletter/unsubscribe?token=` | Unsubscribe — sets `active: false` |
| `GET` | `/api/categories` | List all categories (name, slug, description, color) — for nav/filter UI |
| `GET` | `/api/tags` | List all tags (name, slug) — for tag-cloud/filter UI |
| `GET` | `/api/search?q=` | Search published posts by title/excerpt. Query params: `?q=&page=&limit=` |

### Notes on public routes

**`POST /api/comments`** — server-side validation order:
1. Validate required fields (`authorName`, `authorEmail`, `body`, `postId`)
2. Validate reCAPTCHA token (score < 0.5 → silent `200` discard, no error exposed to client)
3. Check IP rate limit via DynamoDB (`ratelimit:{ip}` key, max 3/hour)
4. Strip HTML from `body` — store plain text only
5. `insertOne` with `status: "pending"`
6. Send SES alert to `ADMIN_ALERT_EMAIL`

**`POST /api/views/:id`** — always returns `200` regardless of dedup outcome.
The response does not indicate whether the view was counted. Non-blocking from the
client perspective — fired after page load, not awaited.

**`POST /api/newsletter`** — idempotent on email. If the email already exists with
`active: true` and `confirmedAt` set, return `200` without re-sending. If previously
unsubscribed (`active: false`), re-activate and re-send confirmation.

**`GET /api/search?q=`** — matches published posts by `title`/`excerpt` (requires the
text index noted in [`docs/data-model.md`](data-model.md#posts) — add it if it isn't
there yet). Every request, regardless of result count, logs
`{ query, resultsCount, ip, createdAt }` to the native-driver `search_logs` collection —
this is what backs `/search` and the "recent searches" view in the admin analytics
dashboard (see [`docs/data-model.md`](data-model.md)).

---

## Admin routes — JWT required

All `/api/admin/*` routes require `users.role` in the JWT. The Lambda Authorizer returns
`403 Forbidden` if the role is insufficient before the Express handler runs.

### Posts

| Method | Route | Min role | Description |
|---|---|---|---|
| `GET` | `/api/admin/posts` | `editor` | All posts — all statuses, all authors |
| `POST` | `/api/admin/posts` | `editor` | Create post |
| `PUT` | `/api/admin/posts/:id` | `editor` | Update post — triggers revalidation pipeline on publish |
| `DELETE` | `/api/admin/posts/:id` | `editor` | Delete post + invalidate CloudFront path |

On `PUT` when `status` changes to `"published"`:
1. Set `publishedAt: new Date()` if not already set
2. Call `revalidatePost(post)` — uploads HTML to S3 + invalidates CloudFront
3. Return after revalidation is confirmed (not fire-and-forget — client gets confirmation)

**`POST`/`PUT`** additionally validate `format`'s conditional fields before writing —
`format: "gallery"` requires a non-empty `media` array, `format: "video"` requires
`videoId`. A violation returns `422` with the existing business-rule-violation shape (see
"Error response shape" below), same category as publishing a post with no body. This is
a route-level check in addition to — not instead of — the schema-level validator in
[`docs/data-model.md`](data-model.md#posts), so a bad request is rejected before it ever
reaches Mongoose.

### Categories

| Method | Route | Min role | Description |
|---|---|---|---|
| `GET` | `/api/admin/categories` | `editor` | List all categories, full detail |
| `PUT` | `/api/admin/categories/:id` | `editor` | Edit `description`/`color` only |

> Categories are a fixed set of 10 (see [`docs/data-model.md`](data-model.md)) — `name`
> and `slug` are not editable via this route, and there is no create or delete route.
> Changing a slug would orphan every existing `posts.category` value referencing it and
> break the `[category]` route in `web/app/[category]/`.

### Tags

| Method | Route | Min role | Description |
|---|---|---|---|
| `GET` | `/api/admin/tags` | `editor` | List all tags, full detail |
| `POST` | `/api/admin/tags` | `editor` | Create a tag — slug auto-generated from `name`, same `uniqueSlug()` convention as posts |
| `DELETE` | `/api/admin/tags/:id` | `editor` | Delete a tag |

> Unlike categories, tags aren't a fixed set — editors create them ad hoc while tagging
> posts, so (unlike Categories above) create and delete both exist here. Deleting a tag
> does **not** cascade to `posts.tags` — same orphan-without-cascade convention as
> deleting a user (see Users below). A post referencing a deleted tag's slug just won't
> resolve on a tag lookup; drop it from display rather than erroring, the same way a
> deleted author is handled.

### Comments

| Method | Route | Min role | Description |
|---|---|---|---|
| `GET` | `/api/admin/comments` | `editor` | Pending comment queue (`status: "pending"`) |
| `PUT` | `/api/admin/comments/:id` | `editor` | Set status: `{ status: 'approved' \| 'rejected' }` |
| `DELETE` | `/api/admin/comments/:id` | `editor` | Hard delete — used for confirmed spam |

### Subscribers

| Method | Route | Min role | Description |
|---|---|---|---|
| `GET` | `/api/admin/subscribers` | `editor` | Confirmed subscriber list |
| `DELETE` | `/api/admin/subscribers/:id` | `editor` | Remove subscriber (sets `active: false` — soft delete) |
| `POST` | `/api/admin/newsletter/send` | `editor` | Send newsletter campaign |

### Users

| Method | Route | Min role | Description |
|---|---|---|---|
| `GET` | `/api/admin/users` | `super-admin` | All users — `passwordHash` excluded |
| `POST` | `/api/admin/users` | `super-admin` | Create user |
| `PUT` | `/api/admin/users/:id` | `super-admin` | Edit name, email, avatar |
| `PUT` | `/api/admin/users/:id/role` | `super-admin` | Assign role — user must re-login for new JWT |
| `PUT` | `/api/admin/users/:id/status` | `super-admin` | Enable/disable: `{ active: bool }` |
| `DELETE` | `/api/admin/users/:id` | `super-admin` | Hard delete — posts are orphaned, not deleted |

> Deleting a user orphans their posts — `posts.authorId` is not cascaded.
> Display as `"Deleted author"` in the frontend when `authorId` lookup returns null.

### Media

| Method | Route | Min role | Description |
|---|---|---|---|
| `GET` | `/api/admin/upload-url?filename=&type=` | `editor` | Returns S3 presigned `PutObject` URL (60s expiry) + CloudFront CDN URL |
| `GET` | `/api/admin/media` | `editor` | List media library. Query params: `?page=&limit=` |
| `POST` | `/api/admin/media` | `editor` | Create a media record — body shape depends on `source` (see below) |
| `DELETE` | `/api/admin/media/:id` | `editor` | Remove a media record (and its S3 object, if `source: 'upload'`) |

These live in two separate route files (`server/routes/admin/upload-url.ts` and
`server/routes/admin/media.ts`) because they sit on either side of the upload: `upload-url`
only talks to S3 and runs *before* a file exists — there's no `media` document yet to
touch. `media` owns the `media` collection itself — it's called *after* the fact, either
once the browser's direct-to-S3 `PUT` has succeeded (`source: "upload"`), or immediately
for a pasted external link with no S3 step at all (`source: "url"`). `media.ts`'s `DELETE`
also removes the S3 object for `source: "upload"` records, but only as a side effect of
owning that record's lifecycle — it has no other reason to call S3.

The browser uploads directly to S3 using the presigned URL — the file never passes through
Lambda. See [`docs/workflows.md`](workflows.md) for the full upload flow, including the
URL-reference path.

**`POST /api/admin/media`** — two request shapes, chosen by `source`:

```json
// source: "upload" — sent after the browser finishes the direct-to-S3 PUT
{ "source": "upload", "filename": "cover.jpg", "url": "https://d1abc.cloudfront.net/media/...", "size": 204800, "mimeType": "image/jpeg" }

// source: "url" — sent when the editor pastes an external image link instead of uploading
{ "source": "url", "url": "https://example.com/some-image.jpg" }
```

For `source: "url"`, the server validates the link before saving (see
[`docs/workflows.md`](workflows.md#media-upload-flow) for the validation steps and the
SSRF safeguards required around it) and returns `422` if it doesn't resolve to an image.

### Analytics

| Method | Route | Min role | Description |
|---|---|---|---|
| `GET` | `/api/admin/analytics` | `editor` | Aggregated snapshots. Query params: `?from=&to=&postId=&category=` |

Reads from the native-driver `analytics` collection (see
[`docs/data-model.md`](data-model.md)) — daily snapshots keyed by `(date, postId)` or
`(date, category)`, with a site-wide row when both are `null`.

> **Open question:** nothing in this project currently documents *how* `analytics`
> documents get created — there's no scheduled/batch job in
> [`docs/aws-infrastructure.md`](aws-infrastructure.md) aggregating `page_views` into
> daily snapshots (only `BlogApiFunction` and `AdminAuthorizerFunction` are defined
> there). Building this route without also deciding on that aggregation job (a scheduled
> Lambda via EventBridge is the obvious shape, given everything else here is already
> serverless) means the route has nothing to actually read. Resolve this before or
> alongside implementing the route, not by assuming the collection populates itself.

### Audit log

| Method | Route | Min role | Description |
|---|---|---|---|
| `GET` | `/api/admin/audit-log` | `super-admin` | List audit entries. Query params: `?targetType=&targetId=&userId=&page=&limit=` |

Read-only — there is no `POST` here. Entries are written as a side effect of other
admin actions (post publish, user role change, comment moderation, etc., per
[`docs/data-model.md`](data-model.md)) via a shared `logAudit()` helper called from each
mutating service, not through this route. `super-admin`-only to view, since the log
itself covers actions across every role.

---

## Error response shape

All error responses use a consistent shape:

```json
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE"
}
```

| HTTP status | When |
|---|---|
| `400` | Validation failure (missing required fields, invalid ObjectId, etc.) |
| `401` | No JWT present or JWT expired |
| `403` | JWT valid but role insufficient |
| `404` | Resource not found |
| `409` | Conflict (e.g. duplicate email on subscriber create) |
| `422` | Business rule violation (e.g. publishing a post with no body) |
| `429` | Rate limit exceeded |
| `500` | Unhandled server error — log to CloudWatch |
