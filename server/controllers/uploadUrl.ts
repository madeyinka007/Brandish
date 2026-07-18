import type { Request, Response } from 'express';
import { asyncHandler } from '../lib/errors';
import * as uploadUrlService from '../services/uploadUrl';

export const getUploadUrl = asyncHandler(async (req: Request, res: Response) => {
  const { filename, type } = req.query as { filename?: string; type?: string };
  const result = await uploadUrlService.getUploadUrl(filename, type);
  res.status(200).json(result);
});
