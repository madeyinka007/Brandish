# Server build phases — prompt plan

A set of self-contained prompts for building `server/` incrementally, one at a time. Each
prompt assumes only what's already true in the repo at that point — CLAUDE.md's repository
structure, the docs it points to, and whatever the prior prompts in this file produced.

Run them in order. Each includes its own acceptance check so you know when to move to the
next one.

---

## Phase 1 — Server foundation

### 1.1 — Express + serverless-http entrypoint

> Implement `server/index.ts` as the Express app entrypoint for this Lambda, per
> CLAUDE.md's repository structure ("Express app + serverless-http export") and
> `docs/aws-infrastructure.md`'s Lambda + API Gateway section.
>
> Requirements:
> - Create the Express `app`, with `express.json()` body parsing and `cors` (allow-origin
>   from `process.env.FRONTEND_URL`).
> - Add a `GET /api/health` route returning `{ status: "ok" }` — no auth, no DB — purely
>   to smoke-test that the Lambda/local server is wired up before any real routes exist.
> - Export `const handler = serverlessHttp(app)` for Lambda.
> - Also export `app` directly, and when the file is run as the entrypoint (not
>   `require`'d, i.e. `require.main === module`), call `app.listen(process.env.PORT ||
>   3001)` — this is what `npm run dev` (nodemon + ts-node) actually runs locally, since
>   there's no Lambda runtime in dev.
> - Do not add any content routes yet (posts/comments/etc.) — those are later phases.
>
> Acceptance: `npm run dev` in `server/` starts a local server on port 3001;
> `curl localhost:3001/api/health` returns `200 {"status":"ok"}`.

### 1.2 — Mongoose connection

> Implement `server/lib/mongoose.ts` following the caching pattern already specified in
> `docs/workflows.md` ("Mongoose connection pattern") — do not invent a different pattern.
>
> Requirements:
> - `mongoose.connect(process.env.MONGODB_URI!, { maxPoolSize: 10, dbName: 'wt-brandish' })`
>   — **never** hard-code the connection string; it's already in `server/.env` as
>   `MONGODB_URI` (see `server/.env.example`).
> - Cache the connection promise at module scope; in `development`, cache it on
>   `global._mongooseConnPromise` so hot-reloads reuse it instead of reconnecting.
> - Export `dbConnect()` returning the cached promise, and the promise itself as default,
>   exactly as documented in `docs/workflows.md`.
>
> Acceptance: a throwaway script (or the test in 1.4) can `await dbConnect()` and resolve
> without error against the real Atlas cluster in `server/.env`.

### 1.3 — QueryBuilder base class

> This is a new convention, not yet in `docs/`. Add it as its own building block that
> every model-specific query builder will extend, so route handlers (posts, comments,
> subscribers, etc. in later phases) don't each re-implement filtering/sorting/pagination.
>
> Create `server/lib/queryBuilder.ts`:
> - `class QueryBuilder<T>` constructed with a Mongoose `Model<T>` and the raw Express
>   `req.query` object.
> - Chainable methods operating on an internal Mongoose `Query`:
>   - `.filter(allowedFields: string[])` — builds a Mongo filter only from whitelisted
>     query params present in `req.query` (never pass `req.query` through unfiltered).
>   - `.sort()` — reads `?sort=field` / `?sort=-field` (leading `-` = descending),
>     defaults to `-createdAt` if absent.
>   - `.paginate()` — reads `?page=&limit=`, defaults `page=1`, `limit=20`, caps `limit`
>     at a sane max (e.g. 100) to prevent an unbounded `?limit=999999`.
>   - `.select(fields: string)` — optional field projection.
> - `.exec()` — runs the built query and returns the results.
> - Keep it generic and model-agnostic — no collection-specific logic in this file.
>
> Then, as a concrete example (not a full feature — just proving the base class works):
> create a `PostQueryBuilder extends QueryBuilder<PostDoc>` in the same file or an
> adjacent one, adding a `.byCategory()` / `.byStatus()` method on top of the inherited
> chain, so future post routes can do
> `new PostQueryBuilder(Post, req.query).filter([...]).byCategory().paginate().exec()`.
>
> Since this is a new convention: add `server/lib/queryBuilder.ts` to CLAUDE.md's
> repository structure, and add a short "Adding a new query builder" convention note to
> `docs/development.md` once this is built, so the pattern doesn't stay undocumented.
>
> Acceptance: a unit test (mocked Model, no real DB) confirms `.filter()` drops
> non-whitelisted params, `.paginate()` applies defaults, and `PostQueryBuilder`'s
> `.byCategory()` narrows the filter correctly.

### 1.4 — DB connection test

> Write `server/__tests__/lib/mongoose.test.ts`. Per `docs/development.md`'s unit-testing
> convention, this is a **unit** test — it must not open a real connection to Atlas.
>
> Requirements:
> - `jest.mock('mongoose')` so `mongoose.connect` is a mock, not a real call.
> - Assert `dbConnect()` calls `mongoose.connect` with `process.env.MONGODB_URI` and
>   `{ maxPoolSize: 10, dbName: 'wt-brandish' }`.
> - Assert calling `dbConnect()` twice only calls `mongoose.connect` **once** — this is
>   the actual thing worth testing here: that the caching behaves as documented, not that
>   Atlas is reachable (that's an operational/manual check, not a unit test).
>
> Acceptance: `npm test` in `server/` passes with zero network calls.

---

## Later phases

Superseded by [`module-prompts.md`](module-prompts.md) — a prompt per backend module
(Categories, Tags, Users, Authentication, Media, Posts, Comments, Newsletter, Search,
Analytics, Audit log), each following the routes → controllers → services → domain-model
layering formalized in `docs/development.md` once Phase 1 above is done.

`web/` (Next.js) beyond the Authentication module's `web/lib/auth.ts` piece is still a
separate, not-yet-detailed phase list — ask for it once `server/` is stable.
