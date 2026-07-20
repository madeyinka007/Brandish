import {
  DeleteItemCommand,
  DynamoDBClient,
  PutItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import dotenv from "dotenv"
dotenv.config()

// Module scope, same rationale as the Mongo connection helpers — reused across warm
// Lambda invocations instead of reconnecting on every call.
const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const DEDUP_TABLE = process.env.DYNAMO_DEDUP_TABLE!;
const RATELIMIT_TABLE = process.env.DYNAMO_RATELIMIT_TABLE!;
const REFRESH_TABLE = process.env.DYNAMO_REFRESH_TABLE!;

const VIEW_DEDUP_TTL_SECONDS = 86400; // 24 hours
const RATE_LIMIT_WINDOW_SECONDS = 3600; // 1 hour
const RATE_LIMIT_MAX = 3;

/**
 * Conditional write for the `view_dedup` table (docs/data-model.md). Returns `true` the
 * first time this (ip, postId) pair is seen within the TTL window — the caller should
 * proceed to `$inc posts.viewCount`. Returns `false` on a duplicate within the window —
 * the caller should skip the increment (see docs/workflows.md's view-count flow).
 */
export async function checkAndSetViewDedup(ip: string, postId: string): Promise<boolean> {
  try {
    await client.send(new PutItemCommand({
      TableName: DEDUP_TABLE,
      Item: {
        pk: { S: `view:${ip}:${postId}` },
        ttl: { N: String(Math.floor(Date.now() / 1000) + VIEW_DEDUP_TTL_SECONDS) },
      },
      ConditionExpression: 'attribute_not_exists(pk)',
    }));
    return true;
  } catch (err: any) {
    if (err.name === 'ConditionalCheckFailedException') {
      return false;
    }
    throw err;
  }
}

/**
 * Atomically increments the per-IP comment counter in the `ratelimit` table
 * (docs/data-model.md) and reports whether this request is still within the allowed rate
 * (max 3 per hour). `ttl` is set only on the first request in the window via
 * `if_not_exists`, so the window doesn't reset on every attempt — only the first request
 * in a given hour anchors it.
 */
export async function checkRateLimit(ip: string): Promise<boolean> {
  const result = await client.send(new UpdateItemCommand({
    TableName: RATELIMIT_TABLE,
    Key: { pk: { S: `ratelimit:${ip}` } },
    UpdateExpression: 'ADD #count :one SET #ttl = if_not_exists(#ttl, :ttl)',
    ExpressionAttributeNames: { '#count': 'count', '#ttl': 'ttl' },
    ExpressionAttributeValues: {
      ':one': { N: '1' },
      ':ttl': { N: String(Math.floor(Date.now() / 1000) + RATE_LIMIT_WINDOW_SECONDS) },
    },
    ReturnValues: 'UPDATED_NEW',
  }));

  const count = Number(result.Attributes?.count?.N ?? '0');
  return count <= RATE_LIMIT_MAX;
}

// ---- Refresh-token store (auth module) ----
//
// Rotating refresh tokens need server-side storage so the old token can be invalidated on
// each refresh. Using the same TTL-table pattern as the two stores above: the record
// auto-expires, revocation is a delete, and there's no long-lived state to clean up.
//
// LOCAL-DEV FALLBACK — set `AUTH_STORE=memory` to keep refresh tokens in a process-local Map
// instead of DynamoDB. This lets login/refresh/logout work locally with no AWS credentials and
// no `refresh_tokens` table. NEVER use it in production: the store is per-process (lost on
// restart, not shared across Lambda instances). Anything other than `memory` (or unset) uses
// DynamoDB. Only the refresh-token store has this fallback — view-dedup and rate-limit still
// require DynamoDB.
const USE_MEMORY_TOKEN_STORE = process.env.AUTH_STORE === 'memory';
const memoryTokens = new Map<string, { userId: string; expiresAtSec: number }>();

if (USE_MEMORY_TOKEN_STORE) {
  // eslint-disable-next-line no-console
  console.warn(
    '[auth] AUTH_STORE=memory — refresh tokens are kept in-process (local dev only, NOT for production).',
  );
}

const nowSec = () => Math.floor(Date.now() / 1000);

/** Persists an opaque refresh token → userId, auto-expiring after `ttlSeconds`. */
export async function storeRefreshToken(token: string, userId: string, ttlSeconds: number): Promise<void> {
  if (USE_MEMORY_TOKEN_STORE) {
    memoryTokens.set(token, { userId, expiresAtSec: nowSec() + ttlSeconds });
    return;
  }
  await client.send(new PutItemCommand({
    TableName: REFRESH_TABLE,
    Item: {
      pk: { S: `refresh:${token}` },
      userId: { S: userId },
      ttl: { N: String(nowSec() + ttlSeconds) },
    },
  }));
}

/**
 * Atomically reads **and deletes** a refresh token, returning its userId — this is the
 * rotation primitive. `DeleteItem` with `ReturnValues: ALL_OLD` guarantees a token can be
 * consumed at most once even under concurrent refresh attempts. Returns `null` if the
 * token was absent, already consumed, or expired-but-not-yet-purged (DynamoDB TTL deletion
 * is eventual, so we re-check the stored `ttl` rather than trust the item's absence alone).
 */
export async function consumeRefreshToken(token: string): Promise<string | null> {
  if (USE_MEMORY_TOKEN_STORE) {
    const rec = memoryTokens.get(token);
    memoryTokens.delete(token); // get-and-delete: a token is consumable at most once (rotation)
    if (!rec) return null;
    if (rec.expiresAtSec < nowSec()) return null; // expired
    return rec.userId;
  }
  const result = await client.send(new DeleteItemCommand({
    TableName: REFRESH_TABLE,
    Key: { pk: { S: `refresh:${token}` } },
    ReturnValues: 'ALL_OLD',
  }));
  const userId = result.Attributes?.userId?.S;
  if (!userId) return null;
  const ttl = Number(result.Attributes?.ttl?.N ?? '0');
  if (ttl && ttl < nowSec()) return null;
  return userId;
}

/** Deletes a refresh token unconditionally — used on logout. Idempotent. */
export async function revokeRefreshToken(token: string): Promise<void> {
  if (USE_MEMORY_TOKEN_STORE) {
    memoryTokens.delete(token);
    return;
  }
  await client.send(new DeleteItemCommand({
    TableName: REFRESH_TABLE,
    Key: { pk: { S: `refresh:${token}` } },
  }));
}
