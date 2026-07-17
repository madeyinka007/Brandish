import jwt from 'jsonwebtoken';
import dotenv from "dotenv"
dotenv.config()

// Seconds, not a "15m" string — the string form runs into @types/jsonwebtoken's
// `StringValue` template type under strict mode; a number is always accepted.
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes

export interface AccessTokenPayload {
  userId: string;
  role: string;
  email: string;
}

/** Signs a short-lived access token. Verified by requireAuth and the Lambda authorizer. */
export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
}

/** Verifies + decodes an access token. Throws (JsonWebTokenError/TokenExpiredError) on any failure. */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as jwt.JwtPayload;
  return { userId: decoded.userId, role: decoded.role, email: decoded.email };
}
