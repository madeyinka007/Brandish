# CLAUDE.md — Blog CMS Project

> This file is read by Claude Code on every session. It is the entry point for
> understanding this project. Detailed documentation lives in `docs/`.
> Keep all files up to date as the system evolves.

---

## Project overview

Brandish is built for a Nigerian business media publication covering Advertising,
Money, Public Relations, Telecoms, FMCG, Leadership, Government, Energy, Technology, and
Entertainment. The frontend is a Next.js app deployed on AWS Amplify. The API is an Express
app wrapped with `serverless-http` and deployed as a single AWS Lambda function behind API
Gateway. Content is stored in MongoDB Atlas. All infrastructure runs on AWS.

**Core features:** post management, moderated comments, newsletter subscription (double
opt-in), social media sharing (OG tags + client-side share buttons), and post view counting
with per-IP deduplication via DynamoDB TTL.

---

## Tech stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js (App Router) | SSG + ISR equivalent via S3 + CloudFront |
| API | Express + `serverless-http` | Single Lambda — easy to migrate to EC2/ECS later |
| Database | MongoDB Atlas M0 | Free tier; upgrade to M10 when needed |
| ODM | Mongoose | Used for `users`, `posts`, `categories`, `tags`, `comments`, `subscribers`. All other MongoDB collections (`media`, `page_views`, `analytics`, `search_logs`, `audit_log`, `notifications`) use the native driver directly — see `docs/data-model.md` |
| View dedup | AWS DynamoDB | TTL-based; ephemeral only — not a content store |
| Media | AWS S3 + CloudFront | Presigned URL uploads; never route through Lambda |
| Email | AWS SES | Transactional alerts + bulk newsletter delivery |
| Secrets | AWS SSM Parameter Store | SecureString for all credentials |
| Hosting | AWS Amplify Hosting | Serves Next.js; backed by CloudFront + S3 |
| CI/CD | GitHub Actions | Separate jobs for frontend and API |
| Auth | Custom JWT (API-owned) | Express-issued access tokens + rotating refresh tokens (DynamoDB). Replaced NextAuth server-side; `web/` NextAuth wiring pending rework. See `docs/auth.md` |
| Rich text | Tiptap | JSON output stored in `posts.body` |
| Testing | Jest (`ts-jest`) | Unit tests only, in both `web/` and `server/` — DB/AWS clients are mocked, no real network calls. See `docs/development.md` |

---

## Repository structure

`web/` and `server/` are independent projects — each has its own `package.json`,
`node_modules`, and lockfile, and each can be installed, run, and deployed without the
other present. There is no root-level workspace tying them together. Shared code (Mongoose
models, `types/`, slug generation) is not imported across the boundary — it is duplicated
identically in both trees, per the existing convention (see `docs/development.md`).

```
/
├── web/                           # Next.js app — runs and deploys independently
│   ├── app/                       # Next.js App Router
│   │   ├── page.tsx               # Homepage — featured + recent posts
│   │   ├── [category]/
│   │   │   ├── page.tsx           # Category listing (ISR)
│   │   │   └── [slug]/
│   │   │       └── page.tsx       # Post page (ISR)
│   │   ├── search/
│   │   │   └── page.tsx           # Search results (SSR — dynamic query)
│   │   ├── admin/
│   │   │   ├── login/page.tsx     # Credentials login form — NOT gated
│   │   │   └── (dashboard)/       # Route group — gated, URL-transparent (/admin, /admin/posts, ...)
│   │   │       ├── layout.tsx     # getServerSession gate; redirects to /admin/login
│   │   │       ├── page.tsx       # Dashboard
│   │   │       ├── posts/page.tsx
│   │   │       ├── categories/page.tsx
│   │   │       ├── media/page.tsx
│   │   │       ├── comments/page.tsx
│   │   │       ├── subscribers/page.tsx
│   │   │       ├── mailing/page.tsx
│   │   │       ├── users/page.tsx
│   │   │       ├── analytics/page.tsx
│   │   │       └── settings/page.tsx
│   │   ├── api/
│   │   │   └── auth/
│   │   │       └── [...nextauth]/route.ts  # NextAuth handler — the one Next.js-hosted API route
│   │   └── newsletter/
│   │       └── confirm/page.tsx   # Email confirmation landing page
│   │
│   ├── components/
│   │   ├── PostCard.tsx
│   │   ├── PostBody.tsx
│   │   ├── ShareBar.tsx           # Client-side share: X, LinkedIn, WhatsApp, Facebook
│   │   ├── ViewCounter.tsx        # Fires POST /views/:id on mount (non-blocking)
│   │   ├── CommentThread.tsx
│   │   ├── CommentForm.tsx        # Includes reCAPTCHA v3
│   │   └── NewsletterBanner.tsx
│   │
│   ├── lib/
│   │   ├── mongodb.ts             # Cached MongoClient for Next.js server components
│   │   ├── mongoose.ts            # Cached Mongoose connection for Next.js server components
│   │   ├── models/                # Mongoose models — identical copy of server/lib/models/
│   │   │   ├── User.ts
│   │   │   ├── Post.ts
│   │   │   ├── Category.ts
│   │   │   ├── Tag.ts
│   │   │   ├── Comment.ts
│   │   │   └── Subscriber.ts
│   │   ├── slug.ts                # Identical copy of server/lib/slug.ts
│   │   └── auth.ts                # NextAuth config
│   │
│   ├── types/
│   │   ├── index.ts                # TypeScript interfaces for every collection — identical copy of server/types/index.ts
│   │   └── next-auth.d.ts          # Module augmentation: Session/User/JWT (userId, role, avatar)
│   │
│   ├── __tests__/                  # Jest unit tests — mirrors lib/, DB/AWS clients mocked
│   │   └── lib/
│   │       └── slug.test.ts
│   │
│   ├── amplify.yml                 # Amplify build spec
│   ├── jest.config.js
│   ├── package.json
│   ├── .gitignore
│   └── .env.local
│
├── server/                        # Express API (Lambda target) — runs and deploys independently
│   ├── index.ts                   # Express app + serverless-http export
│   ├── authorizer.ts              # API Gateway Lambda Authorizer — verifies our Bearer access token; gates /api/admin/*
│   ├── routes/                    # Wiring only — path + middleware + controller method, no logic
│   │   ├── auth.ts                 # /api/auth/* — login, refresh, logout, password, verify (see docs/auth.md)
│   │   ├── posts.ts
│   │   ├── comments.ts 
│   │   ├── views.ts
│   │   ├── newsletter.ts
│   │   ├── categories.ts
│   │   ├── tags.ts
│   │   ├── search.ts
│   │   └── admin/
│   │       ├── posts.ts
│   │       ├── comments.ts
│   │       ├── users.ts
│   │       ├── subscribers.ts
│   │       ├── categories.ts
│   │       ├── tags.ts
│   │       ├── media.ts
│   │       ├── upload-url.ts
│   │       ├── search-logs.ts
│   │       ├── analytics.ts
│   │       └── audit-log.ts
│   ├── controllers/                # Orchestrate one request each — call one service method, shape the response
│   │   ├── auth.ts
│   │   ├── posts.ts
│   │   ├── comments.ts
│   │   ├── users.ts
│   │   ├── newsletter.ts
│   │   ├── categories.ts
│   │   ├── tags.ts
│   │   ├── uploadUrl.ts
│   │   ├── media.ts
│   │   ├── search.ts
│   │   ├── analytics.ts
│   │   └── auditLog.ts
│   ├── services/                   # Business logic — the only layer allowed to call domain models / getDb()
│   │   ├── auth.ts                  # login/logout/refresh (rotation)/forgot/reset/change/verify — see docs/auth.md
│   │   ├── posts.ts
│   │   ├── comments.ts
│   │   ├── users.ts
│   │   ├── newsletter.ts
│   │   ├── categories.ts
│   │   ├── tags.ts
│   │   ├── uploadUrl.ts             # S3 presigned URL only — no DB access at all
│   │   ├── media.ts                # Native-driver — no BaseModel; calls getDb() directly (see docs/development.md)
│   │   ├── search.ts               # Native-driver — no BaseModel; calls getDb() directly
│   │   ├── analytics.ts            # Native-driver — no BaseModel; calls getDb() directly
│   │   └── auditLog.ts             # Native-driver — no BaseModel; calls getDb() directly
│   ├── middleware/
│   │   ├── auth.ts                # requireAuth (Bearer access-token verify) + requireRole
│   │   ├── rateLimit.ts           # IP rate limiting via DynamoDB TTL
│   │   ├── recaptcha.ts           # reCAPTCHA v3 token validation
│   │   └── errorHandler.ts        # Central error middleware — AppError → { error, code }
│   ├── lib/
│   │   ├── mongodb.ts             # Cached MongoClient + getDb() (native-driver collections; dbName wt-brandish)
│   │   ├── mongoose.ts            # Cached Mongoose connection (Mongoose collections)
│   │   ├── mongo.ts               # MongoLibrary — per-model wrapper, sole point of contact with Mongoose; see docs/development.md
│   │   ├── model.ts               # BaseModel<T> — every domain model extends this; see docs/development.md
│   │   ├── jwt.ts                 # Access-token sign/verify (jsonwebtoken)
│   │   ├── password.ts            # bcrypt hash/compare (cost 10)
│   │   ├── validation.ts          # Pure request-payload validators (no dependency)
│   │   ├── errors.ts              # AppError + asyncHandler
│   │   ├── models/                # Domain models (BaseModel subclasses via MongoLibrary.createModel); see docs/development.md
│   │   │   ├── User.ts             # + sanitizeUser(); has auth token fields beyond the web/ copy
│   │   │   ├── Post.ts
│   │   │   ├── Category.ts
│   │   │   ├── Tag.ts
│   │   │   ├── Comment.ts
│   │   │   └── Subscriber.ts
│   │   ├── slug.ts                # slugify() (pure) + uniqueSlug() (Post-bound, auto-suffix; self-excluding on update)
│   │   ├── categoryUsage.ts       # isCategoryInUse() — Categories delete-guard seam; wired to PostModel.exists
│   │   ├── s3.ts                  # S3: createPresignedUpload / deleteObject / keyFromCdnUrl (media module)
│   │   ├── imageUrl.ts            # validateImageUrl() SSRF guard — protocol + private-IP + HEAD image check
│   │   ├── dynamo.ts              # DynamoDB client + view-dedup, rate-limit, refresh-token stores
│   │   ├── ses.ts                 # SES email helpers
│   │   ├── revalidate.ts          # S3 upload + CloudFront invalidation
│   │   └── auditLog.ts            # logAudit() helper (native driver) — called from services on mutating admin actions
│   │
│   ├── types/
│   │   └── index.ts               # TypeScript interfaces for every collection — identical copy of web/types/index.ts
│   │
│   ├── scripts/                    # One-off operational scripts (not part of the request path)
│   │   ├── seedSuperAdmin.ts       # Bootstrap the first super-admin — `npm run seed:admin`; see docs/auth.md
│   │   └── seedCategories.ts       # Seed the 10 launch categories — `npm run seed:categories`
│   │
│   ├── __tests__/                 # Jest unit tests — mirrors routes/controllers/services/middleware/lib/scripts; DB/AWS clients mocked
│   │   ├── controllers/
│   │   │   ├── auth.test.ts
│   │   │   ├── users.test.ts
│   │   │   ├── categories.test.ts
│   │   │   ├── tags.test.ts
│   │   │   ├── posts.test.ts
│   │   │   ├── uploadUrl.test.ts
│   │   │   └── media.test.ts
│   │   ├── services/
│   │   │   ├── auth.test.ts
│   │   │   ├── users.test.ts
│   │   │   ├── categories.test.ts
│   │   │   ├── tags.test.ts
│   │   │   ├── posts.test.ts
│   │   │   ├── uploadUrl.test.ts
│   │   │   └── media.test.ts
│   │   ├── scripts/
│   │   │   ├── seedSuperAdmin.test.ts
│   │   │   └── seedCategories.test.ts
│   │   ├── middleware/
│   │   │   ├── auth.test.ts
│   │   │   ├── recaptcha.test.ts
│   │   │   └── rateLimit.test.ts
│   │   └── lib/
│   │       ├── slug.test.ts
│   │       ├── categoryUsage.test.ts
│   │       ├── mongoose.test.ts
│   │       ├── mongodb.test.ts
│   │       ├── mongo.test.ts
│   │       ├── model.test.ts
│   │       ├── dynamo.test.ts
│   │       ├── s3.test.ts
│   │       ├── imageUrl.test.ts
│   │       ├── jwt.test.ts
│   │       ├── password.test.ts
│   │       └── validation.test.ts
│   │
│   ├── template.yaml              # AWS SAM — Lambda + API Gateway definition
│   ├── jest.config.js
│   ├── tsconfig.json
│   ├── package.json
│   ├── .gitignore
│   ├── .env.example
│   └── .env
│
├── .github/workflows/
│   ├── deploy-api.yml             # sam deploy on push to main — scoped to server/
│   └── amplify-build.yml          # Amplify triggers independently on web/; this notifies on status
│
├── docs/
│   ├── data-model.md              # MongoDB + DynamoDB schemas and indexes
│   ├── api-routes.md              # All public and admin API routes
│   ├── auth.md                    # Authentication (API-owned JWT), roles, and middleware patterns
│   ├── openapi-auth.yaml          # OpenAPI 3.1 spec for the /api/auth endpoints
│   ├── aws-infrastructure.md      # AWS services, env vars, CI/CD, cost
│   ├── workflows.md               # Core flows: ISR, media, comments, newsletter
│   └── development.md             # Local dev setup, conventions, slug generation
│
└── CLAUDE.md                      # This file
```

---

## Documentation index

| File | Contents |
|---|---|
| [`docs/data-model.md`](docs/data-model.md) | MongoDB collections (posts, categories, users, comments, subscribers, media), DynamoDB tables, and all indexes |
| [`docs/api-routes.md`](docs/api-routes.md) | Public and admin API route reference |
| [`docs/auth.md`](docs/auth.md) | Role definitions, API-owned JWT auth (access + rotating refresh tokens), auth flows, middleware |
| [`docs/openapi-auth.yaml`](docs/openapi-auth.yaml) | OpenAPI 3.1 spec for the `/api/auth` endpoints |
| [`docs/aws-infrastructure.md`](docs/aws-infrastructure.md) | AWS services, all environment variables, CI/CD pipeline, cost estimates |
| [`docs/workflows.md`](docs/workflows.md) | MongoDB connection pattern, ISR revalidation, media upload, comment moderation, newsletter send |
| [`docs/development.md`](docs/development.md) | Local dev commands, key conventions, slug generation |