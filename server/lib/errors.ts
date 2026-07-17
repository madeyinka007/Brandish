import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Thrown by services to signal a client-facing failure with a specific HTTP status and
 * machine-readable code. The error middleware (server/middleware/errorHandler.ts) turns
 * these into the standard `{ error, code }` response shape (docs/api-routes.md). Anything
 * that isn't an `AppError` reaching the middleware becomes a generic 500.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Wraps an async controller so a rejected promise is forwarded to Express's error
 * middleware instead of crashing the request — keeps controllers free of try/catch
 * boilerplate (they orchestrate; error translation is centralized).
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
