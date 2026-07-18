# AWS infrastructure and deployment

All infrastructure runs on AWS. The frontend and API are deployed independently — either
can be redeployed without touching the other.

---

## AWS services

### Amplify Hosting — Next.js frontend

- Connected to the `main` branch on GitHub
- Auto-deploys on every push — no manual trigger needed
- `web/amplify.yml`'s `preBuild` phase runs `npm test` before `npm run build` — a failing
  Jest suite fails the Amplify build, same gate as `deploy-api.yml` running `npm test`
  before `sam deploy` (see CI/CD below)
- Environment variables set in the Amplify console (not in code or `.env` files)
- Backed by CloudFront + S3 under the hood
- `NEXT_PUBLIC_API_URL` must point to the API Gateway invoke URL

### Lambda + API Gateway — Express API

- Single Lambda function (`BlogApiFunction`) wrapping the Express app via `serverless-http`
- A second, separate Lambda (`AdminAuthorizerFunction`, `server/authorizer.ts`) is the actual
  API Gateway Lambda Authorizer — it only checks that a valid API-issued access token is
  present on `/api/admin/*` requests (the `Authorization: Bearer <token>` header) before API
  Gateway even invokes `BlogApiFunction`. Per-route minimum role (editor vs super-admin) is
  enforced separately, inside Express, by `requireRole` — the authorizer doesn't know about
  roles, only "is there a valid token". (This replaced the previous NextAuth session-cookie
  check — auth is now API-owned; see [`docs/auth.md`](auth.md).)
- Defined in `server/template.yaml` (AWS SAM). Both functions build via esbuild
  (`Metadata: BuildMethod: esbuild`) directly from the TypeScript source in `server/` — `sam
  build` compiles them, no separate `tsc` step in the CI pipeline.
- API Gateway HTTP API (not REST API — lower latency, lower cost)
- Environment variables pulled from SSM Parameter Store at cold start via the SAM config
- Timeout: `30s` — sufficient for all current operations
- Memory: `512 MB` — can lower to `256 MB` if cost is a concern after profiling
- `BlogApiFunction`'s IAM policy also grants exactly what `server/lib/*` actually calls at
  runtime: S3 read/write (media + revalidated HTML), the two DynamoDB tables, CloudFront
  `CreateInvalidation`, and SES send — without these the Lambda would `AccessDenied` on
  publish, upload, comment alerts, and newsletter send. The `{{resolve:ssm:...}}` dynamic
  references themselves don't need IAM (CloudFormation resolves those at deploy time, not
  the Lambda's runtime role) — the `SSMParameterReadPolicy` is there to match the
  documented expectation below, not because the current code calls SSM at runtime.

### S3 + CloudFront — media and static pages

Two usage patterns:

**Media uploads (images):**
- Bucket is private; served through CloudFront with Origin Access Control (OAC)
- Editors upload via S3 presigned URLs — files never pass through Lambda
- CloudFront domain is used for all `media.url` values stored in MongoDB
- No public bucket policy — all access goes through CloudFront

**Static HTML pages (ISR equivalent):**
- The Revalidate Lambda uploads rendered HTML to S3 after each post publish
- CloudFront serves the HTML globally with near-zero latency
- `CreateInvalidation` is called per-path (never `/*`) on each publish

### SES — email

- Sending domain verified in SES console before launch
- Request sending limit increase to exit sandbox mode (one-time AWS Support request —
  do this at least 24 hours before launch)
- Transactional: comment alerts, subscription confirmations, unsubscribe confirmations
- Bulk: weekly newsletter digest via `sendBulkTemplatedEmail` in batches of 50
- Standard rate: ~14 emails/second
- Bounce handling: SES → SNS → Lambda webhook → `subscribers.active: false`

### SSM Parameter Store — secrets and config

Only the three real secrets (`MONGODB_URI`, `JWT_SECRET`, `RECAPTCHA_SECRET`) are stored
as `SecureString` (AES-256 encrypted at rest). Everything else (emails, resource IDs,
table names, URLs) isn't a secret and is stored as plain `String`.

This split matters mechanically, and the two kinds of value reach the Lambda by **two
different mechanisms** — the second is a correction to an earlier, non-deployable design:

**Plain-String config** — resolved by CloudFormation at *deploy* time. `Parameters` of type
`AWS::SSM::Parameter::Value<String>` read the plain params and are injected into the function
env via `!Ref`:

```yaml
# server/template.yaml
Parameters:
  SesFromEmail:
    Type: AWS::SSM::Parameter::Value<String>
    Default: /brandish/prod/SES_FROM_EMAIL
  # ...ADMIN_ALERT_EMAIL, CLOUDFRONT_DIST_ID, S3_BUCKET_NAME, CF_DOMAIN, API_BASE_URL, FRONTEND_URL
```

**The three SecureString secrets** (`MONGODB_URI`, `JWT_SECRET`, `RECAPTCHA_SECRET`) are
fetched at *runtime*, not by the template. Two facts force this:
1. `AWS::SSM::Parameter::Value<String>` **cannot read `SecureString` at all** (no
   `<SecureString>` variant of that parameter type), and
2. the `{{resolve:ssm-secure:...}}` dynamic reference **is not permitted in Lambda
   environment variables** — it's only allowed in a small AWS-vetted allow-list of resource
   properties, which Lambda env vars are *not* on. `sam validate --lint` rejects it (E1027).

So both functions run `loadSecrets()` (`server/lib/loadSecrets.ts`) at cold start: it calls
SSM `GetParameters` with `WithDecryption: true` for `${SSM_SECRETS_PREFIX}/<NAME>` and sets
them on `process.env` before anything reads them. The API function's Lambda handler is
`bootstrap.handler` (`server/bootstrap.ts`), which loads secrets and *then* dynamically
imports the Express app — necessary because `lib/mongoose.ts` connects to Mongo at import
time, so `MONGODB_URI` must already be present. `AdminAuthorizerFunction` calls the same
`loadSecrets()` before verifying tokens; it and the API function resolve the **same**
`JWT_SECRET` value or they'd disagree about what a valid token is. Only the config vars are
set directly in the template env; `SSM_SECRETS_PREFIX` (default `/brandish/prod`) tells
`loadSecrets` where to look.

Because secrets are now fetched at runtime, the Lambda execution role **does** need
`ssm:GetParameters` (on `/brandish/prod/*`) and `kms:Decrypt` (on the SecureString key) —
unlike the plain-String config, which CloudFormation still resolves at deploy time with no
runtime permission. `BlogApiFunction` uses a pre-created role (`BrandishLambdaRole`) rather
than a SAM-managed one — see the note at the bottom of `server/template.yaml` for the full
list of what that role needs attached.

### DynamoDB — view dedup and rate limiting

- On-demand billing — pay per request, no provisioned capacity
- TTL attribute enabled on both tables (`ttl` column, Unix seconds)
- Free tier: 25 GB storage + 200M requests/month — comfortably covers this use case
- No backups configured — both tables are ephemeral; data loss is acceptable

---

## Environment variables

### Lambda — stored in SSM Parameter Store

```
# SecureString — real secrets, fetched at RUNTIME by lib/loadSecrets.ts (WithDecryption)
/brandish/prod/MONGODB_URI          # Atlas connection string (srv:// format)
/brandish/prod/JWT_SECRET           # Must match NEXTAUTH_SECRET in Amplify — used by
                                     # both BlogApiFunction and AdminAuthorizerFunction
/brandish/prod/RECAPTCHA_SECRET     # Google reCAPTCHA v3 secret key

# Plain String — not secrets, resolved via CloudFormation Parameters + !Ref at deploy time
/brandish/prod/SES_FROM_EMAIL       # Verified SES sending address
/brandish/prod/ADMIN_ALERT_EMAIL    # Editor notification address
/brandish/prod/CLOUDFRONT_DIST_ID   # CloudFront distribution ID
/brandish/prod/S3_BUCKET_NAME       # Media upload bucket name
/brandish/prod/CF_DOMAIN            # CloudFront domain e.g. d1abc.cloudfront.net
/brandish/prod/API_BASE_URL         # This Lambda's own public API Gateway URL — used to build
                                     # absolute links embedded in outbound emails (e.g. the
                                     # newsletter confirmation link)
/brandish/prod/FRONTEND_URL         # Public frontend URL (same value as NEXTAUTH_URL below) —
                                     # used to redirect GET /api/newsletter/confirm to the
                                     # Next.js thank-you page after confirming
```

> The three DynamoDB table names (`view_dedup`, `ratelimit`, `refresh_tokens`) are **not**
> SSM params — the tables are created in `server/template.yaml` and their names wired into
> the function env via `!Ref`. `template.yaml`'s `SSM_SECRETS_PREFIX` and the `Parameters`
> `Default:` values are the source of truth for the exact SSM paths, not this list.

### Next.js — set in Amplify console

```
NEXT_PUBLIC_API_URL       # API Gateway invoke URL
NEXT_PUBLIC_RECAPTCHA_KEY # reCAPTCHA v3 site key (public — safe to expose)
NEXTAUTH_SECRET           # Must match JWT_SECRET in Lambda
NEXTAUTH_URL              # Production URL e.g. https://yourdomain.ng
MONGODB_URI               # Same Atlas URI — used in Next.js server components
CLOUDFRONT_DIST_ID        # Used by revalidate helper
S3_BUCKET_NAME
CF_DOMAIN
```

### GitHub Actions secrets

```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION              # e.g. af-south-1 (Africa — Lagos) or us-east-1
```

---

## CI/CD pipeline

### `deploy-api.yml` — API deploy on push to `main`

```yaml
name: Deploy API

on:
  push:
    branches: [main]
    paths: ['server/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: server
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm test

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      - name: SAM build
        run: sam build

      - name: SAM deploy
        run: sam deploy --no-confirm-changeset --no-fail-on-empty-changeset
```

`server/` is a standalone npm project (its own `package.json` and lockfile), so the
workflow just needs a `working-directory`, not an npm workspace flag.

Amplify Hosting detects the push independently and builds the Next.js frontend on its
own schedule. The two deploys are fully decoupled — a failed API deploy does not block
the frontend deploy and vice versa.

### Path-based triggers

The `paths` filter on the API workflow means frontend-only changes (components, pages)
do not trigger a Lambda deploy. Add a matching `paths` filter to any Amplify notification
workflow for the same reason.

---

## Cost estimates

### During AWS free tier (first 12 months)

Everything runs at **$0/month** except the domain name (~$10/year).

### After free tier — at 20–50k visits/month

| Service | Estimate |
|---|---|
| Amplify Hosting | ~$0–2 (bandwidth) |
| Lambda + API Gateway | ~$0 (still within 1M free invocations/month) |
| MongoDB Atlas M0 | **$0 forever** (no time limit on free tier) |
| DynamoDB | ~$0 (well within permanent free tier) |
| SES | $0.10 per 1,000 emails |
| S3 | ~$0.023/GB storage |
| CloudFront | ~$0.0085/GB transfer |
| Route 53 | $0.50/hosted zone/month |

**Estimated total at 50k visits/month: under $10/month.**

### Scale trigger points

| Condition | Action |
|---|---|
| Atlas M0 hitting 512 MB | Upgrade to M10 ($57/month) |
| Lambda cold starts affecting P95 latency | Provision 1 concurrency unit (~$15/month) |
| CloudFront transfer > 1 TB/month | Still cheap at $0.0085/GB — no action needed |
| SES newsletter > 10k sends/week | Still $1/1000 emails — consider Brevo at high volume |
