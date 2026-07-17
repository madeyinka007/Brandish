import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../lib/jwt';

/**
 * Verifies the Bearer access token minted by the auth module (server/services/auth.ts) and
 * attaches its payload (`userId`, `role`, `email`) to `req.user`. Replaces the previous
 * NextAuth-cookie verification — the API now issues and owns its own tokens.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', code: 'NO_SESSION' });
  }
  try {
    const payload = verifyAccessToken(header.slice('Bearer '.length).trim());
    (req as any).user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as any).user?.role;
    if (!roles.includes(userRole)) {
      return res.status(403).json({ error: 'Forbidden', code: 'INSUFFICIENT_ROLE' });
    }
    next();
  };
}
