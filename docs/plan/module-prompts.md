# Module build prompts

Self-contained prompts for building each backend module, one at a time, on top of the
Phase 1 foundation in [`server-build-phases.md`](server-build-phases.md) (Express entry
point, Mongoose connection, `MongoLibrary`, `BaseModel`). Every module follows the layered
architecture in [`docs/development.md`](../development.md#layered-architecture-routes--controllers--services--domain-models):
`routes/` (wiring only) → `controllers/` (orchestration only) → `services/` (business
logic) → domain model extending `BaseModel<T>` — **except** the four native-driver
modules (Media, Search, Analytics, Audit log), whose services call `getDb()` directly
instead of extending `BaseModel`, per the ODM split in
[`docs/data-model.md`](../data-model.md#odm-strategy).

Suggested build order, since some modules depend on another's model existing first:
**Categories → Tags → Users → Authentication → Media → Posts → Comments → Newsletter →
Search → Analytics → Audit log.** (Audit log's *write side* — `logAudit()` — is a
dependency of Users/Posts/Comments/Categories/Media/Newsletter's services, but is listed
last because its own admin *route* doesn't depend on anything; see its prompt for how
that's sequenced.)

---

## 1. Categories — ✅ BUILT

> **Already implemented** as a dynamic, editor-managed taxonomy (full CRUD + generated
> slugs, ordering, status, SEO metadata), replacing the original fixed-set design. Files:
> `server/lib/models/Category.ts` (`CategoryModel extends BaseModel`, `CATEGORY_STATUSES`),
> `server/lib/slug.ts` (`slugify` — pure, collection-agnostic), `server/lib/categoryUsage.ts`
> (delete-guard seam), `server/services/categories.ts`, `server/controllers/categories.ts`,
> `server/routes/categories.ts` (public) + `server/routes/admin/categories.ts` (editor+),
> `server/scripts/seedCategories.ts` (`npm run seed:categories`). Tests:
> `server/__tests__/{services,controllers}/categories.test.ts` + `__tests__/scripts/seedCategories.test.ts`.
> Docs reconciled: `docs/data-model.md` (`categories` + posts framing), `docs/api-routes.md`.
>
> Decisions baked in:
> - **`posts.category` stays a denormalized slug string.** Slug is generated from `name` on
>   create and **immutable** — `updateCategory` drops `slug` if present. Renaming `name`
>   never touches the slug.
> - **Delete is guarded:** `409 CATEGORY_IN_USE` if any post references the slug. Flat — no
>   hierarchy.
> - **Duplicate names are rejected (`409 NAME_EXISTS`), not auto-suffixed** — a resolution of
>   a contradiction in the original prompt (a controlled taxonomy shouldn't grow
>   `technology-2`; auto-suffixing is a posts behavior).
>
> **✅ Delete guard wired (Posts module, step 6).** `server/lib/categoryUsage.ts`
> `isCategoryInUse()` now delegates to `(await getPostModel()).exists({ category: slug })`,
> replacing the earlier `501 NOT_IMPLEMENTED` stub — `DELETE` on a category now completes,
> returning `409 CATEGORY_IN_USE` when any post still references the slug.

---

## 2. Tags

> **Already implemented.** Files: `server/lib/models/Tag.ts` (`TagModel extends BaseModel`,
> `{ slug: 1 }` unique, createdAt-only timestamps to match the documented schema),
> `server/services/tags.ts` (`listTags` / `createTag` / `deleteTag`),
> `server/controllers/tags.ts`, `server/routes/tags.ts` (public `GET /api/tags`) +
> `server/routes/admin/tags.ts` (`GET`/`POST`/`DELETE`, editor+). Tests:
> `server/__tests__/{services,controllers}/tags.test.ts`.
>
> Decisions baked in:
> - Slug generated from `name` via `slugify()`; **duplicate → `409 TAG_EXISTS`** (no
>   auto-suffix — a duplicate tag is a real conflict), race-safe via the unique-index
>   `E11000` catch.
> - `deleteTag` is a plain delete, **no cascade** to `posts.tags` (a post referencing a
>   deleted tag's slug just won't resolve; the frontend drops it — see `docs/api-routes.md`).
> - No status/ordering/hierarchy — tags are a flat, ad-hoc label set. Public and admin
>   `GET` share one handler (nothing to filter differently).

---

## 3. Users — ✅ BUILT

> **Already implemented.** Reuses the `User` model built by the Authentication module
> (`server/lib/models/User.ts` — `UserModel extends BaseModel`, `sanitizeUser()`, `ROLES`),
> which already has the `{ email: 1 }` unique index; the model was **not** rebuilt.
> Files: `server/services/users.ts`, `server/controllers/users.ts`,
> `server/routes/admin/users.ts` (mounted at `/api/admin/users`, all
> `requireAuth` + `requireRole('super-admin')`). Tests:
> `server/__tests__/{services,controllers}/users.test.ts`.
>
> Decisions baked in:
> - **`sanitizeUser` is the single projection strategy** (chosen over `select: '-passwordHash'`)
>   — every returned user goes through it, stripping `passwordHash` *and* the reset/verify
>   tokens. The service tests assert none of the four ever leak.
> - `createUser` hashes via `hashPassword` (cost 10, never plaintext) and **issues the
>   verification token + email** — this is what resolves the cross-module TODO in
>   `docs/auth.md`.
> - Duplicate email → `409 EMAIL_EXISTS`, caught race-free from the unique-index `E11000`.
> - `deleteUser` is a hard delete, no cascade to `posts.authorId` (documented orphan).
> - The `reader` role (added to `users.role` in `docs/data-model.md`) is now in the model
>   enum + `ROLES`, so it's assignable — but its *permissions* are still undefined (flagged
>   in `docs/auth.md`).
>
> **Bootstrap seed — BUILT.** `server/scripts/seedSuperAdmin.ts` (`npm run seed:admin`,
> tested) creates the first super-admin directly with `emailVerified: true`, idempotently —
> closing the chicken-and-egg gap (see `docs/auth.md`).
>
> **Known follow-up (not built):** no guard against a super-admin locking themselves out
> (self-deactivate / self-demote) or deleting the **last** super-admin — see the summary.

---

## 4. Authentication — ✅ BUILT (server-side)

> **Already implemented** as a self-contained Express JWT system (this replaced the
> originally-planned NextAuth design — see the architecture note atop `docs/auth.md`). The
> server side is done and tested: login, logout, refresh (with rotation), forgot/reset/
> change password, verify email + resend. Files: `server/routes/auth.ts`,
> `server/controllers/auth.ts`, `server/services/auth.ts`, `server/lib/models/User.ts`,
> `server/lib/{jwt,password,validation,errors}.ts`, refresh-token store in
> `server/lib/dynamo.ts`, `server/lib/ses.ts`, `server/middleware/{auth,errorHandler}.ts`,
> `server/authorizer.ts`. Tests under `server/__tests__/{services,controllers,middleware,lib}`.
> API docs: `docs/openapi-auth.yaml`.
>
> Because this module also built `server/lib/models/User.ts` (with the auth token fields
> and `sanitizeUser()`), the **Users** module (step 3) should extend that same model rather
> than redefine it — and on user create it must issue an `emailVerificationToken` + send the
> verification email (the cross-module TODO flagged in `docs/auth.md`).
>
> **Remaining (separate, not yet built): the `web/` frontend rework.** NextAuth was removed
> only server-side; the frontend still needs to stop using `getServerSession`/NextAuth and
> instead call `/api/auth/*`, hold the access token, and refresh it. Prompt for that as
> part of the (not-yet-detailed) `web/` phase, not here. When it's built:
> - `web/lib/models/User.ts` — schema-equivalent to the server model, built directly with
>   `InferSchemaType` (no `MongoLibrary`/`BaseModel`; those are server-only). Only needed if
>   Next.js server components read users directly.
> - An auth client + token storage (access token in memory; refresh token in an `httpOnly`
>   cookie) and an access-token gate replacing the `getServerSession` gate described
>   (as SUPERSEDED) in `docs/auth.md`.

---

## 5. Media — ✅ BUILT

> **Already implemented** — the first **native-driver** module (no Mongoose model, no
> `BaseModel`; talks to `getDb()` directly, per the ODM split). Two sub-parts, as required.
> Files:
> - **Native-driver infra (new, shared):** `server/lib/mongodb.ts` (cached `MongoClient` +
>   `getDb()`, defaulting to the same `wt-brandish` DB as Mongoose — the doc's old `'blog'`
>   default was stale and would have split collections across databases).
> - **S3:** `server/lib/s3.ts` (`createPresignedUpload` / `deleteObject` / `keyFromCdnUrl`).
> - **SSRF guard:** `server/lib/imageUrl.ts` (`validateImageUrl` + `isPrivateAddress`) —
>   http(s)-only, DNS-resolve-and-reject private/loopback/link-local/CGNAT/ULA (incl.
>   IPv4-mapped IPv6), then a `HEAD` with `redirect: 'error'`, a 5s timeout, and an
>   `image/*` Content-Type requirement.
> - **Upload URL:** `server/services/uploadUrl.ts` (S3 only, no DB) + controller +
>   `server/routes/admin/upload-url.ts`.
> - **Media CRUD:** `server/services/media.ts` (`listMedia`, `createFromUpload`,
>   `createFromUrl`, a `createMedia` source-dispatcher, `deleteMedia` — which also removes
>   the S3 object for `source: 'upload'`) + controller + `server/routes/admin/media.ts`.
> Tests: `server/__tests__/lib/{imageUrl,s3,mongodb}.test.ts`,
> `server/__tests__/{services,controllers}/{uploadUrl,media}.test.ts` — the SSRF suite
> covers the rejected private-IP (metadata-endpoint) and non-image cases, not just the happy path.
>
> Decisions baked in beyond the prompt:
> - `getDb()` defaults to `wt-brandish` (matches Mongoose) — fixed the stale `'blog'` in the docs.
> - `createFromUpload` additionally checks the url is under `CF_DOMAIN` (integrity — an
>   'upload' must be a CloudFront URL we handed out, not an arbitrary external one).
> - Source-dispatch lives in the service (`createMedia`), keeping the controller thin.

---

## 6. Posts — ✅ BUILT

> **Status: built.** `lib/models/Post.ts` (schema + 5 indexes incl. the `title`/`excerpt` text
> index + `media`/`videoId` conditional validators), `lib/slug.ts` `uniqueSlug()` (Post-bound,
> self-excluding on update), `lib/revalidate.ts` (`revalidatePost` + `purgePost` — specific
> paths, never `/*`), `lib/auditLog.ts` (native-driver `logAudit`, best-effort), `services/posts.ts`,
> `controllers/posts.ts`, `routes/posts.ts` + `routes/admin/posts.ts` (mounted at `/api/posts`
> and `/api/admin/posts`). `lib/categoryUsage.ts` wired to `PostModel.exists`. Tests: posts
> service + controller, `uniqueSlug`, `categoryUsage`. Decisions beyond the prompt, all noted in
> code: `logAudit` is implemented for real (native driver) rather than stubbed as a no-op, since
> `lib/auditLog.ts` is a standalone helper (the read-side audit *route* remains module 11);
> `createPost` also revalidates + audits a post created already-`published`; editing a live post
> re-runs `revalidatePost`; `actorId` is threaded into `updatePost`/`deletePost` (the prompt's
> `(id, data)` sketch omitted it, but the required `logAudit(..., userId, ...)` needs it).
>
> Build the Posts module — the flagship one. Read `docs/data-model.md`'s `posts` schema (including the format-conditional-fields validator) and `docs/api-routes.md`'s Posts section in full. Depends on Users (embedded `author`) and Categories/Tags (denormalised slugs) existing first.

> - `server/lib/models/Post.ts` — `MongoLibrary.createModel<PostDoc>('Post', {...})` with all four indexes from `docs/data-model.md` (including the new text index for search) and the `media`/`videoId` conditional validator.
> - `PostModel extends BaseModel<PostDoc>` — no query-builder subclassing (that pattern was deliberately removed earlier in this project; use `BaseModel`'s generic
`.find(filter, options)` directly from the service instead — build the filter object
>   in the service, e.g. `{ category, status }`).
`server/services/posts.ts`:
`createPost(data, author)` — generate the slug server-side via `uniqueSlug()` from
`lib/slug.ts` (never trust a client-submitted slug), embed `author.{_id,name,avatar}`,
validate the format-conditional fields (`422` on violation — this is the route-level
check that sits *in addition to* the schema validator, per `docs/api-routes.md`) `updatePost(id, data)` — re-validate slug uniqueness if the slug is being edited;
when `status` transitions to `"published"`: set `publishedAt` if unset, call
`revalidatePost()` from `lib/revalidate.ts`, and only respond after revalidation resolves (not fire-and-forget — see `docs/api-routes.md`) `deletePost(id)` — delete + invalidate the specific CloudFront path (never `/*`) `listPosts(filter, options)` / `getPublishedBySlug(slug)` for the public route `server/controllers/posts.ts` + `server/routes/posts.ts` (public) + `server/routes/admin/posts.ts` (`requireAuth` + `requireRole('editor', 'super-admin')`).
> - Call `logAudit('post.publish', 'post', id, userId, {...})` (see the Audit log module) from `updatePost` on the publish transition, and from `deletePost` — these are exactly the "destructive or sensitive operations" `docs/data-model.md` says the audit log exists for. If the Audit log module isn't built yet, stub this call behind a
same-signature no-op and come back to it — don't skip documenting that it's expected.

> **Also wire up the Categories delete-guard** (deferred from the Categories module):
> replace the stub body of `server/lib/categoryUsage.ts` `isCategoryInUse(slug)` — which currently throws `501 NOT_IMPLEMENTED` — with `(await getPostModel()).exists({ category: slug })`. Until this is done, deleting a category fails; the Categories tests already cover both guard outcomes via a mock.

Tests: service (mocked `PostModel` and mocked `revalidatePost`; cover the format-conditional `422` for both `gallery` without `media` and `video` without
`videoId`) and controller (mocked service). Add a test that `isCategoryInUse` now
delegates to `PostModel.exists`.

---

## 7. Comments

> Build the Comments module. Read `docs/api-routes.md`'s Comments section and
> `docs/workflows.md`'s comment moderation flow — the exact validation order there
> (fields → reCAPTCHA → rate limit → sanitize → insert → SES alert) is not optional
> ordering, it's what makes the reCAPTCHA/rate-limit middleware meaningful. Depends on
> Posts (`postId` ref) and needs `server/lib/ses.ts` (still an empty scaffold file) built
> as part of this module, since Comments is the first module that needs it.
>
> - `server/lib/ses.ts` — a `sendEmail(to, subject, body)` helper wrapping
>   `@aws-sdk/client-ses`, reading `SES_FROM_EMAIL` from env.
> - `server/lib/models/Comment.ts` + `CommentModel extends BaseModel<CommentDoc>`, with
>   the `{ postId: 1, status: 1 }` index.
> - `server/services/comments.ts`:
>   - `submitComment(data, ip)` — strip HTML via `sanitize-html` (empty allowlist, plain
>     text only), `create()` with `status: 'pending'`, then `sendEmail()` to
>     `ADMIN_ALERT_EMAIL` with a one-click approve/reject link — a short-lived JWT
>     (`jsonwebtoken`, 48h expiry) signed with `JWT_SECRET`, per `docs/workflows.md`
>   - `listPending()`; `moderate(id, status)`; `deleteComment(id)` (hard delete, for
>     confirmed spam)
>   - the one-click moderation action handler (verifies the signed token, then calls
>     `moderate()`) — this is invoked from the email link, not the admin panel
> - **Note:** `submitComment` itself does *not* call reCAPTCHA/rate-limit — those are
>   `requireRecaptcha`/`rateLimit` **middleware**, already built, that run before the
>   controller. The service only runs once both have already passed.
> - `server/controllers/comments.ts` + `server/routes/comments.ts` (public `GET`/`POST`,
>   `POST` chained behind `validateRecaptcha` + `rateLimit`) +
>   `server/routes/admin/comments.ts`.
>
> Tests: service (mocked `CommentModel` + mocked `sendEmail`; assert HTML is actually
> stripped, not just passed through) and controller (mocked service).

---

## 8. Newsletter

> Build the Newsletter module (the `subscribers` collection). Read `docs/data-model.md`'s
> `subscribers` schema, `docs/api-routes.md`'s public newsletter routes + Subscribers
> admin section, and `docs/workflows.md`'s newsletter send flow.
>
> - `server/lib/models/Subscriber.ts` + `SubscriberModel extends BaseModel<SubscriberDoc>`,
>   with the `{ email: 1 }` unique and `{ token: 1 }` indexes.
> - `server/services/newsletter.ts`:
>   - `subscribe(email, categories)` — idempotent: already active+confirmed → `200` with
>     no re-send; previously unsubscribed → reactivate and re-send confirmation.
>     Generates `token` via `crypto.randomBytes(32).toString('hex')`.
>   - `confirm(token)` / `unsubscribe(token)`
>   - `listConfirmed()`; `removeSubscriber(id)` — **soft delete only**
>     (`active: false`) — hard-deleting is explicitly on the "never do this" list in
>     `docs/development.md`, because it allows a re-subscribe to silently skip the
>     double-opt-in the record already proves happened once.
>   - `sendCampaign(categoryFilter?)` — query confirmed subscribers (optionally filtered
>     by category), fetch posts published in the last 7 days, send via
>     `sendEmail`/`sendBulkTemplatedEmail` in batches of 50, embedding each subscriber's
>     own unique unsubscribe link
> - `server/controllers/newsletter.ts` + `server/routes/newsletter.ts` (public) +
>   `server/routes/admin/subscribers.ts` (admin list/delete/send).
>
> Tests: service (mocked `SubscriberModel` + mocked `sendEmail`; cover both branches of
> the idempotent `subscribe()` — already-active and previously-unsubscribed) and
> controller (mocked service).

---

## 9. Search

> Build the Search module. Read the `GET /api/search` note just added to
> `docs/api-routes.md`. This service is a **hybrid** — it reads from the Mongoose `Post`
> model (via `BaseModel`, same as the Posts module) *and* writes to the native-driver
> `search_logs` collection (via `getDb()`) in the same request. That's not a violation of
> "never mix ODM access patterns for one collection" (`docs/development.md`) — it's two
> different collections, each accessed the correct way for its own ODM strategy.
>
> - `server/services/search.ts` — `search(query, page, limit)`:
>   1. `PostModel.find({ $text: { $search: query }, status: 'published' }, { page, limit })`
>      — a plain `FilterQuery`, no changes needed to `BaseModel`/`MongoLibrary` to support
>      this, `$text` is just a Mongo query operator.
>   2. Regardless of result count, `getDb().collection('search_logs').insertOne({ query,
>      resultsCount, ip, createdAt: new Date() })`.
>   3. Return the posts.
> - `server/controllers/search.ts` + `server/routes/search.ts`.
>
> Tests: service (mocked `PostModel.find` and mocked `getDb()`; assert the log write
> happens even when `resultsCount` is `0`) and controller (mocked service).

---

## 10. Analytics

> Build the Analytics module's **read side only** — read the "Open question" callout just
> added to `docs/api-routes.md`'s Analytics section before starting. The `analytics`
> collection's *write* side (a batch/scheduled job aggregating `page_views` into daily
> snapshots — almost certainly an EventBridge-scheduled Lambda, since everything else here
> is already serverless) is undecided and not part of this prompt. Don't build a route
> that reads from a collection nothing populates without flagging that gap explicitly if
> you hit it.
>
> - `server/services/analytics.ts` — native driver via `getDb()` (no `BaseModel`):
>   `getSnapshots({ from, to, postId, category })` — a filtered read against the
>   `analytics` collection's documented shape.
> - `server/controllers/analytics.ts` + `server/routes/admin/analytics.ts`
>   (`requireAuth` + `requireRole('editor', 'super-admin')`).
>
> Tests: service (mocked `getDb()`) and controller (mocked service). Flag in the PR/commit
> description that this reads from a collection with no documented writer yet.

---

## 11. Audit log

> Build the Audit log module. Read `docs/data-model.md`'s `audit_log` schema and
> `docs/api-routes.md`'s Audit log section — this is native-driver, read-only as a
> **route** (`GET` only, `super-admin`-only), but its *write* helper is a dependency of
> every other mutating module (Users, Posts, Comments, Categories, Media, Newsletter).
>
> - `server/lib/auditLog.ts` — `logAudit(action, targetType, targetId, userId, metadata, ip)`:
>   a plain function (not a `BaseModel` subclass — it's a shared write-side helper other
>   services call into, not a domain model of its own) that `insertOne`s into `audit_log`
>   via `getDb()`.
> - `server/services/auditLog.ts` — `listAuditLog({ targetType, targetId, userId, page, limit })`
>   — native driver read.
> - `server/controllers/auditLog.ts` + `server/routes/admin/audit-log.ts`
>   (`requireRole('super-admin')` only — this log spans every role, so only the top role
>   reads it).
> - **Follow-up, not part of this prompt's own routes:** once `logAudit()` exists, go back
>   to Users/Posts/Comments/Categories/Media/Newsletter's services and add the calls this
>   project's docs already say should be there (post publish/delete, user role change,
>   comment moderation, etc., per `docs/data-model.md`) — don't leave them as the
>   silently-never-fulfilled TODO the Posts module prompt above flags.
>
> Tests: `lib/auditLog.ts` (mocked `getDb()`; assert the exact document shape written),
> `services/auditLog.ts` (mocked `getDb()`), and the controller (mocked service).
