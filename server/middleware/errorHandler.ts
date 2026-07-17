import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors';

/**
 * Central Express error middleware — must be registered last, after all routes. Turns an
 * `AppError` into the standard `{ error, code }` response (docs/api-routes.md); anything
 * else is an unexpected fault, logged and returned as a generic 500 so internals never
 * leak to the client. The 4-arg signature is what marks it as an error handler to Express,
 * so `_next` stays in the signature even though it's unused.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message, code: err.code });
  }
  console.error(err);
  return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
}
