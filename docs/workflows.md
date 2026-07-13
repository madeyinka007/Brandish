# Core workflows

Implementation patterns and code references for the five most critical runtime flows.

---

## MongoDB connection pattern

Lambda containers are reused between warm invocations. Cache the `MongoClient` outside
the handler so it persists across warm calls, avoiding a new TCP handshake on every request.

```ts
// server/lib/mongodb.ts  (identical copy lives in web/lib/mongodb.ts for Next.js server components)
import { MongoClient } from 'mongodb';

const uri     = process.env.MONGODB_URI!;
const options = { maxPoolSize: 10 }; // Atlas M0 max: 500 connections total

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === 'development') {
  // In dev, reuse the cached client across hot-reloads
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production (Lambda), module scope is reused across warm invocations
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;

export async function getDb(dbName = 'blog') {
  const c = await clientPromise;
  return c.db(dbName);
}
```

**Why `maxPoolSize: 10`:** Atlas M0 allows 500 total connections. With multiple warm
Lambda instances each holding a pool of 10, you have headroom for ~50 concurrent Lambda
containers before hitting the Atlas limit. Monitor connection count in Atlas if scaling.

---

## Mongoose connection pattern

Used for the six Mongoose-backed collections (`users`, `posts`, `categories`, `tags`,
`comments`, `subscribers` — see [`docs/data-model.md`](data-model.md#odm-strategy)). Same
caching rationale as the native driver above — same `MONGODB_URI`, same `maxPoolSize: 10`,
same Atlas database (`wt-brandish`) — but using `mongoose.connect()` instead of `MongoClient`.

```ts
// server/lib/mongoose.ts  (identical copy lives in web/lib/mongoose.ts for Next.js server components)
import mongoose from 'mongoose';

const uri     = process.env.MONGODB_URI!;
const options = { maxPoolSize: 10, dbName: 'wt-brandish' }; // Atlas M0 max: 500 connections total

let connPromise: Promise<typeof mongoose>;

declare global {
  var _mongooseConnPromise: Promise<typeof mongoose> | undefined;
}

if (process.env.NODE_ENV === 'development') {
  // In dev, reuse the cached connection across hot-reloads
  if (!global._mongooseConnPromise) {
    global._mongooseConnPromise = mongoose.connect(uri, options);
  }
  connPromise = global._mongooseConnPromise;
} else {
  // In production (Lambda), module scope is reused across warm invocations
  connPromise = mongoose.connect(uri, options);
}

export default connPromise;

export async function dbConnect() {
  return connPromise;
}
```

**Usage in a route handler:**
```ts
import { dbConnect } from '../lib/mongoose';
import Post from '../lib/models/Post';

await dbConnect();
const post = await Post.findOne({ slug, status: 'published' });
```

Mongoose models (`web/lib/models/*.ts`, duplicated identically in `server/lib/models/*.ts`)
use `InferSchemaType` to derive their TypeScript type directly from the schema definition,
so no cross-project import of `types/index.ts` is needed — each model file stays
self-contained, consistent with `web/` and `server/` being independent projects that never
import from each other.

---

## ISR equivalent — post revalidation

Vercel's ISR is replicated manually. The Revalidate Lambda runs after every post publish
or update, renders fresh HTML, uploads it to S3, and invalidates the CloudFront cache.

```ts
// server/lib/revalidate.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';

const s3 = new S3Client({ region: process.env.AWS_REGION });
const cf = new CloudFrontClient({ region: 'us-east-1' }); // CloudFront is always us-east-1

export async function revalidatePost(post: Post) {
  // 1. Render the post to HTML
  //    Use Next.js renderToStaticMarkup or a pre-built template function
  const html = await renderPostToHTML(post);

  // 2. Upload rendered HTML to S3
  const key = `${post.category}/${post.slug}/index.html`;
  await s3.send(new PutObjectCommand({
    Bucket:      process.env.S3_BUCKET_NAME,
    Key:         key,
    Body:        html,
    ContentType: 'text/html; charset=utf-8',
    CacheControl: 'public, max-age=0, must-revalidate',
  }));

  // 3. Invalidate CloudFront cache for the post page AND the category listing
  await cf.send(new CreateInvalidationCommand({
    DistributionId: process.env.CLOUDFRONT_DIST_ID,
    InvalidationBatch: {
      CallerReference: `${post._id}-${Date.now()}`,
      Paths: {
        Quantity: 2,
        Items: [
          `/${post.category}/${post.slug}`,
          `/${post.category}`,           // so the listing shows the new post
        ],
      },
    },
  }));
}
```

**Timeline:** S3 upload (~200ms) + CloudFront propagation (10–30s typical, 60s max).
**Cost:** `CreateInvalidation` costs $0.005 per 1,000 paths — negligible at blog scale.
**Do not** use `['/*']` — it invalidates the entire distribution and is expensive.

---

## Media upload flow

The media library supports two ways to add an item — a direct file upload, or referencing
an already-hosted image by URL. Both end with a `media` document, distinguished by
`source` (see [`docs/data-model.md`](data-model.md) for the schema).

### Path A — direct upload

Images must never route through Lambda (6 MB payload limit; bandwidth cost). Use S3
presigned URLs so the browser uploads directly to S3.

**Step 1 — request a presigned URL from the API:**
```ts
// server/routes/admin/upload-url.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({ region: process.env.AWS_REGION });

router.get('/upload-url', requireAuth, async (req, res) => {
  const { filename, type } = req.query as { filename: string; type: string };
  const ext = filename.split('.').pop();
  const key = `media/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket:      process.env.S3_BUCKET_NAME,
      Key:         key,
      ContentType: type,
    }),
    { expiresIn: 60 } // 60 second window to upload
  );

  const cdnUrl = `https://${process.env.CF_DOMAIN}/${key}`;
  res.json({ uploadUrl, cdnUrl });
});
```

**Step 2 — browser uploads directly to S3:**
```ts
// Frontend component
const { uploadUrl, cdnUrl } = await fetch(
  `/api/admin/upload-url?filename=${file.name}&type=${file.type}`
).then(r => r.json());

await fetch(uploadUrl, {
  method: 'PUT',
  body: file,
  headers: { 'Content-Type': file.type },
});

// cdnUrl is now the permanent CloudFront URL — store it in the post form
setCoverImage(cdnUrl);
```

**Step 3 — save the `media` record via the API, then set `posts.coverImage`:**

Both paths share one route, branching on `source`:

```ts
// server/routes/admin/media.ts
router.post('/media', requireAuth, async (req, res) => {
  const { source } = req.body;

  if (source === 'upload') {
    // The file itself was already written straight to S3 in step 2 (Path A) — this call
    // just records it. Trust size/mimeType/url as reported by the client.
    const { filename, url, size, mimeType } = req.body;
    await db.collection('media').insertOne({
      source, filename, url, size, mimeType,      // url: CloudFront URL — never the raw S3 URL
      uploadedBy: new ObjectId(req.user.userId),
      createdAt:  new Date(),
    });
    return res.status(201).json({ url });
  }

  // source === 'url' (Path B) — referencing an already-hosted image, no upload involved.
  // Validate before saving: this is a server-side fetch of a user-supplied URL, so it
  // needs the same SSRF guard as any other user-controlled outbound request:
  //   1. Reject non-http(s) protocols
  //   2. Resolve the hostname and reject private/loopback/link-local ranges
  //      (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, ::1)
  //      — this blocks SSRF against the Lambda's own metadata endpoint or internal AWS services
  //   3. HEAD request with a short timeout; require a 2xx and an `image/*` Content-Type
  const { url } = req.body;
  const check = await validateImageUrl(url); // throws on any of the above
  if (!check.ok) {
    return res.status(422).json({ error: 'URL is not a reachable image', code: 'INVALID_MEDIA_URL' });
  }

  await db.collection('media').insertOne({
    source:     'url',
    filename:   null,
    url,                             // stored as-is — served directly from the source, not CloudFront
    size:       null,                // never downloaded, so size is unknown
    mimeType:   check.mimeType ?? null,
    uploadedBy: new ObjectId(req.user.userId),
    createdAt:  new Date(),
  });
  res.status(201).json({ url });
});
```

**Do not** skip the SSRF guard in `validateImageUrl` — the Lambda's execution role has AWS
permissions, and an unguarded server-side fetch of a user-supplied URL is a path to
internal network access (e.g. the EC2/Lambda metadata service), not just a broken-image
edge case.

The frontend calls this route immediately after either path completes — for Path A, right
after the S3 `PUT` succeeds, using the `cdnUrl` from step 1 — then sets `coverImage` (or
the relevant image field) to the returned `url`.

---

## Comment moderation flow

Full server-side validation before any database write.

```
POST /api/comments
  │
  ├── 1. Validate required fields
  │       authorName, authorEmail, body, postId — return 400 if missing
  │
  ├── 2. reCAPTCHA v3 validation
  │       POST google.com/recaptcha/api/siteverify
  │       score < 0.5 → return 200 silently (discard — don't tell the bot it failed)
  │
  ├── 3. IP rate limit (DynamoDB)
  │       Key: ratelimit:{ip} — max 3 per hour
  │       count >= 3 → return 429 Too Many Requests
  │
  ├── 4. Strip HTML from body
  │       Use a sanitiser (e.g. sanitize-html) — store plain text only
  │
  ├── 5. MongoDB insertOne
  │       { authorName, authorEmail, body, postId, ip, status: 'pending', createdAt: now }
  │
  └── 6. SES alert email to ADMIN_ALERT_EMAIL
          Include: commenter name, post title, body preview,
          approve link: /api/admin/comments/:id?action=approve&token=SIGNED_JWT
          reject link:  /api/admin/comments/:id?action=reject&token=SIGNED_JWT
```

**One-click moderation from email:**
The approve/reject links embed a short-lived signed JWT so editors can act directly
from the email without logging into the CMS. The token is signed with `JWT_SECRET`
and expires in 48 hours.

```ts
// Generate action token
import jwt from 'jsonwebtoken';
const token = jwt.sign(
  { commentId: comment._id.toString(), action: 'approve' },
  process.env.JWT_SECRET!,
  { expiresIn: '48h' }
);
```

---

## Newsletter send flow

```
POST /api/admin/newsletter/send
  │
  ├── 1. Query confirmed subscribers
  │       { active: true, confirmedAt: { $exists: true, $ne: null } }
  │       Optional category filter: { categories: { $in: [selectedSlugs] } }
  │                                  OR categories: [] (empty = subscribed to all)
  │
  ├── 2. Fetch recent posts
  │       { status: 'published', publishedAt: { $gte: sevenDaysAgo } }
  │       Fields: title, slug, excerpt, coverImage, category, publishedAt
  │
  ├── 3. Build HTML per subscriber
  │       Render email template with post list
  │       Embed unique unsubscribe link per recipient:
  │         https://yourdomain.ng/api/newsletter/unsubscribe?token={subscriber.token}
  │
  ├── 4. Send via SES in batches of 50
  │       Use sendBulkTemplatedEmail() or individual sendEmail() calls
  │       Rate: ~14 emails/second on standard tier
  │
  ├── 5. Handle SES bounce webhook (async — via SNS → Lambda)
  │       Hard bounce → subscribers.updateOne({ email }, { $set: { active: false } })
  │
  └── 6. Unsubscribe handler
          GET /api/newsletter/unsubscribe?token=:token
          subscribers.updateOne({ token }, { $set: { active: false, token: null } })
```

**Double opt-in flow (subscribe):**
```
POST /api/newsletter  { email, categories[] }
  │
  ├── Check for existing: if active + confirmed → return 200 (already subscribed)
  │   If inactive → re-activate + re-send confirmation
  │
  ├── Generate token: crypto.randomBytes(32).toString('hex')
  │
  ├── insertOne (or updateOne if email exists):
  │     { email, token, active: false, confirmedAt: null, categories, createdAt }
  │
  └── SES: send confirmation email
            Link: https://yourdomain.ng/api/newsletter/confirm?token={token}

GET /api/newsletter/confirm?token=:token
  ├── findOneAndUpdate({ token }, { $set: { confirmedAt: now, active: true, token: null } })
  └── Redirect to {FRONTEND_URL}/newsletter/confirm (thank you page — web/app/newsletter/confirm/page.tsx)
```
