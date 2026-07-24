import sanitizeHtml from 'sanitize-html';
import { AppError } from '../lib/errors';
import { sendEmail } from '../lib/ses';
import {
  COMMENT_STATUSES,
  getCommentModel,
  type CommentDoc,
  type CommentStatus,
} from '../lib/models/Comment';
import { isEmail, isNonEmptyString } from '../lib/validation';

const LIST_SORT = '-createdAt'; // newest first — the moderation queue works most-recent-down
const LIST_LIMIT = 200;

function isValidStatus(value: unknown): value is CommentStatus {
  return typeof value === 'string' && (COMMENT_STATUSES as readonly string[]).includes(value);
}

/**
 * Admin moderation list. Optionally filtered to a single status (Pending / Approved / Rejected
 * tabs); with no filter it returns every comment, newest first. The frontend derives the tab
 * counts client-side from the full set, so callers pass a status only to page a single queue.
 */
export async function listComments(status?: unknown): Promise<CommentDoc[]> {
  const model = await getCommentModel();
  const filter = isValidStatus(status) ? { status } : {};
  return model.find(filter, { sort: LIST_SORT, limit: LIST_LIMIT });
}

/** Public read: only approved comments for a post, oldest-first (natural reading order). */
export async function listApprovedByPost(postId: unknown): Promise<CommentDoc[]> {
  if (!isNonEmptyString(postId)) {
    throw new AppError(400, 'INVALID_COMMENT_INPUT', 'postId is required');
  }
  const model = await getCommentModel();
  return model.find({ postId, status: 'approved' }, { sort: 'createdAt', limit: LIST_LIMIT });
}

export interface CreateCommentInput {
  postId: unknown;
  authorName: unknown;
  authorEmail: unknown;
  body: unknown;
}

/**
 * Public submit. Validates the payload, strips ALL HTML from the body (plain text only —
 * docs/data-model.md), stores it as `pending`, and best-effort emails the moderation alert.
 * reCAPTCHA + IP rate-limiting are enforced upstream by route middleware, not here.
 */
export async function createComment(input: CreateCommentInput, ip: string): Promise<CommentDoc> {
  const { postId, authorName, authorEmail, body } = input;
  if (!isNonEmptyString(postId) || !isNonEmptyString(authorName) || !isEmail(authorEmail) || !isNonEmptyString(body)) {
    throw new AppError(400, 'INVALID_COMMENT_INPUT', 'postId, authorName, a valid authorEmail, and body are all required');
  }

  const clean = sanitizeHtml(body, { allowedTags: [], allowedAttributes: {} }).trim();
  if (!clean) {
    throw new AppError(400, 'INVALID_COMMENT_INPUT', 'body cannot be empty after stripping markup');
  }

  const model = await getCommentModel();
  let comment: CommentDoc;
  try {
    comment = await model.create({
      postId,
      authorName: authorName.trim(),
      authorEmail: authorEmail.trim().toLowerCase(),
      body: clean,
      status: 'pending',
      ip: ip || '',
    });
  } catch (err: any) {
    if (err?.name === 'CastError') {
      throw new AppError(400, 'INVALID_COMMENT_INPUT', 'postId is not a valid id');
    }
    throw err;
  }

  // Moderation alert — best-effort; a mail failure must not fail the reader's submission.
  const alertTo = process.env.ADMIN_ALERT_EMAIL;
  if (alertTo) {
    try {
      await sendEmail(
        alertTo,
        'New comment awaiting moderation',
        `<p><strong>${authorName}</strong> left a comment:</p><blockquote>${clean.slice(0, 500)}</blockquote>`,
      );
    } catch {
      /* swallow — the comment is already saved */
    }
  }

  return comment;
}

/**
 * Moderation: move a comment to any valid status. Approve → `approved`, Spam/Reject →
 * `rejected`, Unapprove/Not-spam → back to `pending`. (Permanent "trash" is a hard delete —
 * see deleteComment.)
 */
export async function setStatus(id: string, status: unknown): Promise<CommentDoc> {
  if (!isValidStatus(status)) {
    throw new AppError(400, 'INVALID_COMMENT_STATUS', `status must be one of: ${COMMENT_STATUSES.join(', ')}`);
  }
  const model = await getCommentModel();
  const comment = await model.updateById(id, { status });
  if (!comment) {
    throw new AppError(404, 'COMMENT_NOT_FOUND', 'Comment not found');
  }
  return comment;
}

/** Hard delete — the "move to trash → delete permanently" path for confirmed spam. */
export async function deleteComment(id: string): Promise<void> {
  const model = await getCommentModel();
  const deleted = await model.delete(id);
  if (!deleted) {
    throw new AppError(404, 'COMMENT_NOT_FOUND', 'Comment not found');
  }
}
