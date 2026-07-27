import type { Request, Response } from 'express';
import { asyncHandler } from '../lib/errors';
import * as settingsService from '../services/settings';

// GET /api/settings — public-safe subset (blog + admin bootstrap).
export const getPublic = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(await settingsService.getPublicSettings());
});

// GET /api/admin/settings — full settings document (editor+).
export const getAdmin = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(await settingsService.getSettings());
});

// PUT /api/admin/settings — partial patch, deep-merged (super-admin).
export const update = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const settings = await settingsService.updateSettings(req.body ?? {}, userId);
  res.status(200).json(settings);
});
