import type { NextFunction, Request, Response } from 'express';
import { checkRateLimit } from '../lib/dynamo';

/** `x-forwarded-for` may be a comma-separated list (client, proxy1, proxy2, ...) or an
 *  array if the header repeats — the first entry is the original client IP. */
function extractIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (Array.isArray(forwardedFor)) return forwardedFor[0];
  if (typeof forwardedFor === 'string') return forwardedFor.split(',')[0].trim();
  return req.ip ?? '';
}

export async function rateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = extractIp(req);
  const allowed = await checkRateLimit(ip);
  if (!allowed) {
    return res.status(429).json({ error: 'Too Many Requests', code: 'RATE_LIMITED' });
  }
  next();
}
