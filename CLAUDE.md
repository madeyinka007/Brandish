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
| Auth | NextAuth.js | Credentials provider + optional Google OAuth |
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
│   └── .env.local
│
├── server/                        # Express API (Lambda target) — runs and deploys independently
│   ├── index.ts                   # Express app + serverless-http export
│   ├── authorizer.ts              # API Gateway Lambda Authorizer — gates /api/admin/* only
│   ├── routes/
│   │   ├── posts.ts
│   │   ├── comments.ts 
│   │   ├── views.ts
│   │   ├── newsletter.ts
│   │   ├── categories.ts
│   │   └── admin/
│   │       ├── posts.ts
│   │       ├── comments.ts
│   │       ├── users.ts
│   │       ├── subscribers.ts
│   │       ├── categories.ts
│   │       ├── media.ts
│   │       └── upload-url.ts
│   ├── middleware/
│   │   ├── auth.ts                # JWT verification (NextAuth session)
│   │   ├── rateLimit.ts           # IP rate limiting via DynamoDB TTL
│   │   └── recaptcha.ts           # reCAPTCHA v3 token validation
│   ├── lib/
│   │   ├── mongodb.ts             # Cached MongoClient (native driver collections)
│   │   ├── mongoose.ts            # Cached Mongoose connection (Mongoose collections)
│   │   ├── models/                # Mongoose models — identical copy of web/lib/models/
│   │   │   ├── User.ts
│   │   │   ├── Post.ts
│   │   │   ├── Category.ts
│   │   │   ├── Tag.ts
│   │   │   ├── Comment.ts
│   │   │   └── Subscriber.ts
│   │   ├── slug.ts                # Identical copy of web/lib/slug.ts
│   │   ├── dynamo.ts              # DynamoDB client
│   │   ├── ses.ts                 # SES email helpers
│   │   └── revalidate.ts          # S3 upload + CloudFront invalidation
│   │
│   ├── types/
│   │   └── index.ts               # TypeScript interfaces for every collection — identical copy of web/types/index.ts
│   │
│   ├── __tests__/                 # Jest unit tests — mirrors routes/, middleware/, lib/; DB/AWS clients mocked
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── lib/
│   │       └── slug.test.ts
│   │
│   ├── template.yaml              # AWS SAM — Lambda + API Gateway definition
│   ├── jest.config.js
│   ├── tsconfig.json
│   ├── package.json
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
│   ├── auth.md                    # Authentication, roles, and middleware patterns
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
| [`docs/auth.md`](docs/auth.md) | Role definitions, NextAuth config, JWT middleware code |
| [`docs/aws-infrastructure.md`](docs/aws-infrastructure.md) | AWS services, all environment variables, CI/CD pipeline, cost estimates |
| [`docs/workflows.md`](docs/workflows.md) | MongoDB connection pattern, ISR revalidation, media upload, comment moderation, newsletter send |
| [`docs/development.md`](docs/development.md) | Local dev commands, key conventions, slug generation |