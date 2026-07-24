import type { Request, Response } from 'express';
import { asyncHandler } from '../lib/errors';
import * as analyticsService from '../services/analytics';

// GET /api/admin/analytics?days=30 — dashboard overview for the selected window.
export const getAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const days = Number.parseInt(String(req.query.days ?? ''), 10);
  const overview = await analyticsService.getAnalytics(Number.isFinite(days) ? days : undefined);
  res.status(200).json(overview);
});
