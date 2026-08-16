import { ObjectId } from 'mongodb';
import { getDb } from '../lib/mongodb';
import { checkAndSetViewDedup } from '../lib/dynamo';

// ⚠ Native-driver module — `page_views` is a native-driver-only collection (see the ODM split
// in docs/data-model.md). This is the WRITE side of analytics: every public post view appends a
// raw `page_views` event (the analytics service reads this log — server/services/analytics.ts),
// and the post's display counter `posts.viewCount` is incremented once per (IP, post) within the
// dedup TTL window (DynamoDB — server/lib/dynamo.ts). See the view-count flow in docs/workflows.md.

const COLLECTION = 'page_views';
const MAX_DWELL_SEC = 3600;

export interface ViewContext {
  ip: string;
  userAgent?: string;
  referrer?: string | null;
  dwellSec?: number;
}

/**
 * Record a public post view. Best-effort by contract: an invalid id is ignored (returns
 * `false`) rather than throwing, so client-side view tracking can never break a reader's page.
 * Returns `true` when this request also incremented `viewCount` (first view for this IP in the
 * TTL window), `false` on a duplicate or a bad id.
 */
export async function recordView(postId: unknown, ctx: ViewContext): Promise<boolean> {
  if (typeof postId !== 'string' || !ObjectId.isValid(postId)) return false;
  const _id = new ObjectId(postId);
  const ip = ctx.ip || 'unknown';
  const db = await getDb();

  // Raw event log — one row per request. Analytics derives total views from the row count and
  // unique visitors / bounce from distinct IPs, so every hit is logged (refreshes included).
  const dwellSec =
    typeof ctx.dwellSec === 'number' && Number.isFinite(ctx.dwellSec)
      ? Math.max(0, Math.min(MAX_DWELL_SEC, Math.floor(ctx.dwellSec)))
      : 0;
  await db.collection(COLLECTION).insertOne({
    postId: _id,
    ip,
    userAgent: ctx.userAgent ?? '',
    referrer: ctx.referrer ?? null,
    dwellSec,
    viewedAt: new Date(),
  });

  // Deduped display counter — only the first view per (IP, post) in the TTL window counts.
  const first = await checkAndSetViewDedup(ip, postId);
  if (first) {
    await db.collection('posts').updateOne({ _id }, { $inc: { viewCount: 1 } });
  }
  return first;
}
