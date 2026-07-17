# Data model

All primary content is stored in **MongoDB Atlas**. A separate **DynamoDB** table handles
ephemeral view-count deduplication and IP rate limiting. DynamoDB is not a content store —
it holds only short-lived TTL records.

---

## ODM strategy

MongoDB Atlas collections are split across two access patterns, chosen per collection:

| Access pattern | Collections | Why |
|---|---|---|
| **Mongoose** (`web/lib/mongoose.ts`, `server/lib/mongoose.ts`) | `users`, `posts`, `categories`, `tags`, `comments`, `subscribers` | Editorial/relational content with stable shapes — schema validation, defaults, and indexes are declared once on the model and enforced on every write. |
| **Native MongoDB driver** (`web/lib/mongodb.ts`, `server/lib/mongodb.ts`, via `getDb()`) | `media`, `page_views`, `analytics`, `search_logs`, `audit_log`, `notifications` | High-volume or write-heavy/append-only data (media metadata, raw event logs, analytics snapshots) where Mongoose's validation and change-tracking overhead isn't needed. |

Mongoose models live in `web/lib/models/*.ts`, duplicated identically in
`server/lib/models/*.ts` — same convention as the connection helpers (see
[`docs/workflows.md`](workflows.md)). Each model file is self-contained (no cross-project
imports) so `web/` and `server/` stay fully independent, deployable projects.

---

## MongoDB Atlas — collections (Mongoose)

### `posts`

```ts
{
  _id:         ObjectId,          // PK
  title:       string,            // required, max 255 chars
  slug:        string,            // unique index; auto-generated from title
  body:        object,            // Tiptap JSON (rich text)
  excerpt:     string,            // shown in listing cards and OG meta
  format:      'article' | 'gallery' | 'video', // default 'article'
  coverImage:  string,            // CloudFront URL (uploaded via S3 presigned URL)
  category:    string,            // slug — one of the 10 fixed categories below
  tags:        string[],          // array of tag slugs — ref → tags.slug; empty array = no tags
  author: {                       // embedded — denormalised for read speed
    _id:       ObjectId,
    name:      string,
    avatar:    string,
  },
  media:       string[],          // CloudFront URLs — required (non-empty) when format: 'gallery'; unused otherwise
  videoId:     string | null,     // YouTube video ID — required when format: 'video'; unused otherwise
  keywords:    string,            // SEO keywords for dynamic seo settings
  ogImage:     string,            // og image for social sharing and others
  status:      'draft' | 'published' | 'scheduled' | 'archived',
  viewCount:   number,            // default 0; atomically incremented via $inc
  publishedAt: Date | null,       // null until published or scheduled
  createdAt:   Date,
}
```

**Format-conditional fields:** `media` and `videoId` are each required for exactly one
`format` value — `media` (non-empty) for `'gallery'`, `videoId` for `'video'`. Neither is
used for `'article'` (the default). Because each is required only *sometimes*, a plain
schema-level `required: true` on either field is wrong — it would reject every article
and every non-gallery/non-video post. Enforce it with a custom validator that checks the
sibling `format` field instead:

```ts
// server/lib/models/Post.ts (and its identical copy in web/lib/models/Post.ts)
media: {
  type: [String],
  validate: {
    validator: function (this: { format: string }, value: string[]) {
      return this.format !== 'gallery' || (value?.length ?? 0) > 0;
    },
    message: 'media is required when format is "gallery"',
  },
},
videoId: {
  type: String,
  validate: {
    validator: function (this: { format: string }, value: string | null) {
      return this.format !== 'video' || !!value;
    },
    message: 'videoId is required when format is "video"',
  },
},
```

This runs on every `save()`/`create()` regardless of entry point, consistent with why
these six collections are Mongoose-backed in the first place (see the ODM strategy
above) — it isn't a substitute for also checking this in the admin route handler and
returning a `422` before it ever reaches Mongoose (see
[`docs/api-routes.md`](api-routes.md)); the schema validator is the backstop, not the
only check.

**Fixed categories** (slug → display name):

| Slug | Display name |
|---|---|
| `advertising` | Advertising |
| `money` | Money |
| `public-relations` | Public Relations |
| `telecoms` | Telecoms |
| `fmcg` | FMCG |
| `leadership` | Leadership |
| `government` | Government |
| `energy` | Energy |
| `technology` | Technology |
| `entertainment` | Entertainment |

**Indexes:**

```js
{ slug: 1 }                                      // unique
{ category: 1, status: 1, publishedAt: -1 }      // category listing pages
{ status: 1, publishedAt: -1 }                   // homepage + admin post list
{ tags: 1, status: 1, publishedAt: -1 }          // tag listing pages (multikey)
{ title: 'text', excerpt: 'text' }               // GET /api/search (see docs/api-routes.md)
```

Mongoose model: `web/lib/models/Post.ts` (identical copy in `server/lib/models/Post.ts`). `author` is a nested subdocument schema with
`{ _id: false }` so the embedded `_id` stores the real `users._id` value rather than
an auto-generated subdocument id.

---

### `categories`

```ts
{
  _id:         ObjectId,
  name:        string,            // e.g. "Public Relations"
  slug:        string,            // unique index; e.g. "public-relations"
  description: string,
  color:       string,            // hex or CSS variable name for UI accents
}
```

**Index:** `{ slug: 1 }` unique.

Mongoose model: `web/lib/models/Category.ts` (identical copy in `server/lib/models/Category.ts`).

---

### `tags`

```ts
{
  _id:         ObjectId,
  name:        string,            // e.g. "Fintech"
  slug:        string,            // unique index; e.g. "fintech"
  createdAt:   Date,
}
```

**Index:** `{ slug: 1 }` unique.

Mongoose model: `web/lib/models/Tag.ts` (identical copy in `server/lib/models/Tag.ts`). Referenced from `posts.tags` (array of tag slugs,
not ObjectIds — same denormalised-slug convention as `posts.category`).

---

### `users`

```ts
{
  _id:                    ObjectId,
  name:                   string,
  email:                  string,           // unique index
  passwordHash:           string,           // bcrypt hash — NEVER returned in API responses
  role:                   'super-admin' | 'editor' | 'author' | 'reader'
  avatar:                 string,           // URL
  active:                 boolean,          // false = login rejected (see docs/auth.md)
  emailVerified:          boolean,          // default false; login requires true
  emailVerificationToken: string | null,    // single-use; set on user create / resend, cleared on verify
  passwordResetToken:     string | null,    // single-use; set on forgot-password, cleared on reset
  passwordResetExpires:   Date | null,      // reset token expiry (1h window)
  createdAt:              Date,
  updatedAt:              Date,             // managed by Mongoose `timestamps: true`
}
```

**Index:** `{ email: 1 }` unique.

> **Rule:** Never return `passwordHash` — nor `emailVerificationToken`,
> `passwordResetToken`, or `passwordResetExpires` — in any API response, log, or error.
> The auth module's `sanitizeUser()` (`server/lib/models/User.ts`) strips all four; use it
> on every user payload rather than trusting each call site to remember.

The `emailVerificationToken` / `passwordReset*` fields back the auth flows in
[`docs/auth.md`](auth.md). They live on the user document (not DynamoDB) because they're
low-churn account-lifecycle state needing a reverse lookup (token → user) — the same
`token`-on-document convention `subscribers` uses. Refresh tokens are the opposite
(high-churn, ephemeral) and live in DynamoDB instead — see the `refresh_tokens` table below.

Mongoose model: `web/lib/models/User.ts` (schema-equivalent copy at
`server/lib/models/User.ts`, built via `MongoLibrary.createModel` per
[`docs/development.md`](development.md); the `server/` copy adds the auth token fields).

---

### `comments`

```ts
{
  _id:          ObjectId,
  postId:       ObjectId,         // ref → posts._id
  authorName:   string,
  authorEmail:  string,           // stored, never displayed publicly
  body:         string,           // plain text only — strip HTML on write
  status:       'pending' | 'approved' | 'rejected',
  ip:           string,           // for rate limiting and spam tracking
  createdAt:    Date,
}
```

**Index:** `{ postId: 1, status: 1 }` — used by every public comments fetch.

Public `GET /api/comments?postId=` always filters `{ status: 'approved' }`.
Comments with `status: 'pending'` or `'rejected'` are never returned publicly.

Mongoose model: `web/lib/models/Comment.ts` (identical copy in `server/lib/models/Comment.ts`).

---

### `subscribers`

```ts
{
  _id:          ObjectId,
  email:        string,           // unique index
  token:        string,           // crypto.randomBytes(32).toString('hex') — single-use
  confirmedAt:  Date | null,      // null until double opt-in link clicked
  active:       boolean,          // false = unsubscribed; exclude from all sends
  categories:   string[],         // array of category slugs; empty array = all categories
  createdAt:    Date,
}
```

**Indexes:**
- `{ email: 1 }` unique — prevents duplicate subscriptions
- `{ token: 1 }` — confirmation and unsubscribe token lookups

Newsletter audience query:
```js
db.subscribers.find({ active: true, confirmedAt: { $exists: true, $ne: null } })
```

Mongoose model: `web/lib/models/Subscriber.ts` (identical copy in `server/lib/models/Subscriber.ts`).

---

## MongoDB Atlas — collections (native driver)

Accessed via `getDb()` from `web/lib/mongodb.ts` / `server/lib/mongodb.ts` — no Mongoose models.

### `media`

Two ways for an editor to add a media item — `source` distinguishes them, since only one
of the two has a CloudFront-backed URL:

```ts
{
  _id:          ObjectId,
  source:       'upload' | 'url', // how this entry was added — see docs/workflows.md
  filename:     string | null,    // original filename; null for 'url' entries with no reliable name
  url:          string,           // 'upload': CloudFront URL. 'url': the referenced external URL as-is
  size:         number | null,    // bytes — known for 'upload'; null for 'url' (never downloaded)
  mimeType:     string | null,    // known for 'upload'; best-effort (from HEAD Content-Type) for 'url'
  uploadedBy:   ObjectId,         // ref → users._id
  createdAt:    Date,
}
```

**Index:** `{ uploadedBy: 1 }` — filter media library by user in admin panel.

> For `source: 'upload'`, `media.url` must be the **CloudFront URL**, never the raw S3
> URL — S3 is private; only CloudFront (via Origin Access Control) serves it publicly.
> For `source: 'url'`, `media.url` is an arbitrary external URL by design — it is stored
> as-is and served directly from the source, not proxied through CloudFront. Never assume
> `media.url` is same-origin/CloudFront without checking `source` first.

---

### `page_views`

Permanent per-view log, distinct from the ephemeral DynamoDB `view_dedup` table (which
only dedupes within a 24h window and is not queryable history). Used for view trends over
time on the admin analytics dashboard.

```ts
{
  _id:        ObjectId,
  postId:     ObjectId,           // ref → posts._id
  ip:         string,
  userAgent:  string,
  referrer:   string | null,
  viewedAt:   Date,
}
```

**Index:** `{ postId: 1, viewedAt: -1 }` — per-post view history.

---

### `analytics`

Daily aggregated snapshots, one document per `(date, postId)` or `(date, category)` pair.
`postId: null` and `category: null` both set means a site-wide daily snapshot.

```ts
{
  _id:              ObjectId,
  date:             string,           // 'YYYY-MM-DD'
  postId:           ObjectId | null,  // ref → posts._id; null = not post-scoped
  category:         string | null,    // category slug; null = not category-scoped
  views:            number,
  uniqueVisitors:   number,
  avgTimeOnPageSec:  number,
  createdAt:        Date,
}
```

**Indexes:**
- `{ date: 1, postId: 1 }`
- `{ date: 1, category: 1 }`

---

### `search_logs`

Raw log of on-site search queries, backing `/search` and the admin analytics dashboard.

```ts
{
  _id:           ObjectId,
  query:         string,
  resultsCount:  number,
  ip:            string,
  createdAt:     Date,
}
```

**Index:** `{ createdAt: -1 }` — recent searches.

---

### `audit_log`

Append-only trail of admin actions, for accountability on destructive or sensitive
operations (publish, delete, role change, comment moderation, etc.).

```ts
{
  _id:         ObjectId,
  userId:      ObjectId,          // ref → users._id — who performed the action
  action:      string,            // e.g. "post.publish", "user.role_change"
  targetType:  'post' | 'user' | 'comment' | 'subscriber' | 'category' | 'tag',
  targetId:    ObjectId,
  metadata:    object,            // action-specific details (e.g. before/after values)
  ip:          string,
  createdAt:   Date,
}
```

**Indexes:**
- `{ targetType: 1, targetId: 1, createdAt: -1 }`
- `{ userId: 1, createdAt: -1 }`

---

### `notifications`

In-app notifications for admin users (e.g. "new comment pending", "newsletter sent").

```ts
{
  _id:          ObjectId,
  recipientId:  ObjectId,         // ref → users._id
  type:         string,           // e.g. "comment.pending", "newsletter.sent"
  message:      string,
  link:         string | null,    // deep link into the admin panel
  read:         boolean,
  createdAt:    Date,
}
```

**Index:** `{ recipientId: 1, read: 1, createdAt: -1 }`.

---

## DynamoDB tables

### `view_dedup`

Tracks whether a given IP has already been counted for a given post in the last 24 hours.
Auto-deleted after TTL expires — no cleanup code needed.

| Field | Type | Key | Notes |
|---|---|---|---|
| `pk` | String | Partition key | Format: `view:{ip}:{postId}` |
| `ttl` | Number | TTL attribute | Unix seconds: `Math.floor(Date.now()/1000) + 86400` |

**Write pattern (conditional):**
```ts
await dynamo.putItem({
  TableName: 'view_dedup',
  Item: {
    pk:  { S: `view:${ip}:${postId}` },
    ttl: { N: String(Math.floor(Date.now() / 1000) + 86400) },
  },
  ConditionExpression: 'attribute_not_exists(pk)',
});
// If the key exists → throws ConditionalCheckFailedException → skip $inc
// If the key doesn't exist → write succeeds → proceed with $inc on posts.viewCount
```

---

### `ratelimit`

Tracks comment submission rate per IP. Same TTL pattern as `view_dedup`.

| Field | Type | Key | Notes |
|---|---|---|---|
| `pk` | String | Partition key | Format: `ratelimit:{ip}` |
| `count` | Number | — | Incremented on each comment attempt |
| `ttl` | Number | TTL attribute | Unix seconds: `Math.floor(Date.now()/1000) + 3600` (1 hour) |

**Rule:** Max 3 comments per IP per hour. If `count >= 3` → return `429 Too Many Requests`.
Use `UpdateItem` with `ADD count :one` and `attribute_not_exists` to initialise atomically.

---

### `refresh_tokens`

Backs the auth module's refresh-token rotation (see [`docs/auth.md`](auth.md)). One item
per active refresh token; auto-expires via TTL. Ephemeral — like the two tables above,
it's not a content store and needs no backups.

| Field | Type | Key | Notes |
|---|---|---|---|
| `pk` | String | Partition key | Format: `refresh:{opaqueToken}` |
| `userId` | String | — | The user the token authenticates |
| `ttl` | Number | TTL attribute | Unix seconds: `now + 7 days` |

**Rotation is a get-and-delete:** `DeleteItem` with `ReturnValues: ALL_OLD` atomically
reads the `userId` and removes the token in one call, so a token can be redeemed at most
once even under concurrent refreshes. On each `POST /api/auth/refresh` the presented token
is consumed and a fresh one issued; logout deletes it unconditionally. Because TTL deletion
is eventual (up to ~48h), the consumer re-checks the stored `ttl` and rejects an
expired-but-not-yet-purged token rather than trusting absence alone
(`server/lib/dynamo.ts`).
