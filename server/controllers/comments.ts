import type { Request, Response } from 'express';
import { asyncHandler } from '../lib/errors';
import * as commentsService from '../services/comments';

/** `x-forwarded-for` may list several hops (client, proxy1, ...) — the first entry is the client. */
function clientIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (Array.isArray(forwardedFor)) return forwardedFor[0];
  if (typeof forwardedFor === 'string') return forwardedFor.split(',')[0].trim();
  return req.ip ?? '';
}

// ---- Public ----

// GET /api/comments?postId= — approved comments for a post.
export const listPublic = asyncHandler(async (req: Request, res: Response) => {
  const comments = await commentsService.listApprovedByPost(req.query.postId);
  res.status(200).json(comments);
});

// POST /api/comments — reader submission (reCAPTCHA + rate limit applied by route middleware).
export const createComment = asyncHandler(async (req: Request, res: Response) => {
  const { postId, authorName, authorEmail, body } = req.body ?? {};
  const comment = await commentsService.createComment({ postId, authorName, authorEmail, body }, clientIp(req));
  res.status(201).json(comment);
});

// ---- Admin (editor+) ----

// GET /api/admin/comments?status= — moderation list (all statuses, or one queue).
export const listComments = asyncHandler(async (req: Request, res: Response) => {
  const comments = await commentsService.listComments(req.query.status);
  res.status(200).json(comments);
});

// PUT /api/admin/comments/:id — { status: 'approved' | 'rejected' | 'pending' }.
export const moderateComment = asyncHandler(async (req: Request, res: Response) => {
  const comment = await commentsService.setStatus(req.params.id, req.body?.status);
  res.status(200).json(comment);
});

// DELETE /api/admin/comments/:id — hard delete (permanent).
export const deleteComment = asyncHandler(async (req: Request, res: Response) => {
  await commentsService.deleteComment(req.params.id);
  res.status(200).json({ message: 'Comment deleted' });
});
