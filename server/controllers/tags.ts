import type { Request, Response } from 'express';
import { asyncHandler } from '../lib/errors';
import * as tagsService from '../services/tags';

// Public list — lean (no post counts needed for the tag cloud/filter UI).
export const listTags = asyncHandler(async (_req: Request, res: Response) => {
  const tags = await tagsService.listTags();
  res.status(200).json(tags);
});

// Admin list — each tag augmented with `postCount` (usage over posts.tags).
export const listTagsWithUsage = asyncHandler(async (_req: Request, res: Response) => {
  const tags = await tagsService.listTagsWithUsage();
  res.status(200).json(tags);
});

export const createTag = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, color } = req.body ?? {};
  const tag = await tagsService.createTag({ name, description, color });
  res.status(201).json(tag);
});

export const updateTag = asyncHandler(async (req: Request, res: Response) => {
  const tag = await tagsService.updateTag(req.params.id, req.body ?? {});
  res.status(200).json(tag);
});

export const deleteTag = asyncHandler(async (req: Request, res: Response) => {
  await tagsService.deleteTag(req.params.id);
  res.status(200).json({ message: 'Tag deleted' });
});
