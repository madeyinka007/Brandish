import type { Request, Response } from 'express';
import { asyncHandler } from '../lib/errors';
import * as postsService from '../services/posts';

function pagination(req: Request) {
  return {
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  };
}

// ---- Public ----

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await postsService.listPublicPosts({ category: req.query.category, ...pagination(req) });
  res.status(200).json(result);
});

export const getBySlug = asyncHandler(async (req: Request, res: Response) => {
  const post = await postsService.getPublishedBySlug(req.params.slug);
  res.status(200).json(post);
});

// ---- Admin ----

export const adminList = asyncHandler(async (req: Request, res: Response) => {
  const result = await postsService.listAllPosts({
    category: req.query.category,
    status: req.query.status,
    ...pagination(req),
  });
  res.status(200).json(result);
});

export const createPost = asyncHandler(async (req: Request, res: Response) => {
  const post = await postsService.createPost(req.body ?? {}, (req as any).user.userId);
  res.status(201).json(post);
});

export const updatePost = asyncHandler(async (req: Request, res: Response) => {
  const post = await postsService.updatePost(req.params.id, req.body ?? {}, (req as any).user.userId);
  res.status(200).json(post);
});

export const deletePost = asyncHandler(async (req: Request, res: Response) => {
  await postsService.deletePost(req.params.id, (req as any).user.userId);
  res.status(200).json({ message: 'Post deleted' });
});
