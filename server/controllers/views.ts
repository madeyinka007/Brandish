import type { Request, Response } from 'express';
import { asyncHandler } from '../lib/errors';
import * as viewsService from '../services/views';

/** `x-forwarded-for` may list several hops (client, proxy1, ...) — the first entry is the client. */
function clientIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (Array.isArray(forwardedFor)) return forwardedFor[0];
  if (typeof forwardedFor === 'string') return forwardedFor.split(',')[0].trim();
  return req.ip ?? '';
}

// POST /api/views/:id — record a public post view. Best-effort: always 204s, and a tracking
// failure is swallowed so it can never surface an error to the reader. The client sends the
// real traffic source as `referrer` (document.referrer); the Referer header is the fallback.
export const recordView = asyncHandler(async (req: Request, res: Response) => {
  const bodyReferrer = typeof req.body?.referrer === 'string' && req.body.referrer.trim() !== '' ? req.body.referrer : null;
  const referrer = bodyReferrer ?? req.get('referer') ?? null;
  try {
    await viewsService.recordView(req.params.id, {
      ip: clientIp(req),
      userAgent: req.get('user-agent') ?? '',
      referrer,
    });
  } catch {
    // Swallow — analytics tracking must never break the reader's page load.
  }
  res.status(204).end();
});
