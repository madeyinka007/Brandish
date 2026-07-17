import type { Request, Response } from 'express';
import { asyncHandler } from '../lib/errors';
import * as tagsService from '../services/tags';

// Same handler serves both the public and admin list — tags have no status, so there's
// nothing to filter differently between them.
export const listTags = asyncHandler(async (_req: Request, res: Response) => {
  const tags = await tagsService.listTags();
  res.status(200).json(tags);
});

export const createTag = asyncHandler(async (req: Request, res: Response) => {
  const tag = await tagsService.createTag(req.body?.name);
  res.status(201).json(tag);
});

export const deleteTag = asyncHandler(async (req: Request, res: Response) => {
  await tagsService.deleteTag(req.params.id);
  res.status(200).json({ message: 'Tag deleted' });
});
