import type { Request, Response } from 'express';
import { asyncHandler } from '../lib/errors';
import * as mediaService from '../services/media';

export const listMedia = asyncHandler(async (req: Request, res: Response) => {
  const page = req.query.page ? Number(req.query.page) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const media = await mediaService.listMedia(page, limit);
  res.status(200).json(media);
});

export const createMedia = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const media = await mediaService.createMedia(req.body ?? {}, userId);
  res.status(201).json(media);
});

export const deleteMedia = asyncHandler(async (req: Request, res: Response) => {
  await mediaService.deleteMedia(req.params.id);
  res.status(200).json({ message: 'Media deleted' });
});
