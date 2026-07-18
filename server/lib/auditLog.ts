import { ObjectId } from 'mongodb';
import { getDb } from './mongodb';

// Native-driver helper — the `audit_log` collection is native-driver-only (see the ODM split
// in docs/data-model.md), so this writes via getDb() directly, no Mongoose/BaseModel. It's the
// shared write path called from mutating admin services (post publish/delete, role change,
// comment moderation, …). The read side — GET /api/admin/audit-log — is a separate module and
// intentionally not built here (there is no POST route: entries are only ever written like this).

export type AuditTargetType = 'post' | 'user' | 'comment' | 'subscriber' | 'category' | 'tag';

/**
 * Appends one entry to `audit_log`. **Best-effort by design**: an audit write must never fail
 * the action it records, so any error (bad id, DB blip) is logged and swallowed rather than
 * propagated. `ip` is optional — services that have the request IP can pass it; the rest omit it.
 */
export async function logAudit(
  action: string,
  targetType: AuditTargetType,
  targetId: string,
  userId: string,
  metadata: Record<string, unknown> = {},
  ip = '',
): Promise<void> {
  try {
    const db = await getDb();
    await db.collection('audit_log').insertOne({
      userId: new ObjectId(userId),
      action,
      targetType,
      targetId: new ObjectId(targetId),
      metadata,
      ip,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error('[audit] failed to write audit entry', { action, targetType, targetId, err });
  }
}
