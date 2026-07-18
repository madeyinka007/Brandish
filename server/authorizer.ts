import { verifyAccessToken } from './lib/jwt';
import { loadSecrets } from './lib/loadSecrets';

/**
 * API Gateway (HTTP API) Lambda Authorizer — gates `/api/admin/*` before the Express
 * handler runs. It only answers "is there a valid access token?"; per-route role checks
 * stay in Express (`requireRole`). Uses the HTTP API "simple response" format
 * (`{ isAuthorized, context }`), and passes the decoded claims downstream as context.
 *
 * Replaces the previous NextAuth-session-cookie authorizer — the API now issues and
 * verifies its own Bearer tokens (see docs/auth.md).
 */
interface AuthorizerEvent {
  headers?: Record<string, string | undefined>;
}

interface AuthorizerResult {
  isAuthorized: boolean;
  context?: Record<string, string>;
}

export async function handler(event: AuthorizerEvent): Promise<AuthorizerResult> {
  const header = event.headers?.authorization ?? event.headers?.Authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return { isAuthorized: false };
  }
  // JWT_SECRET is fetched from SSM at runtime (not injected via the template) — must be in
  // process.env before verifyAccessToken reads it. No-op locally / once warm.
  await loadSecrets();
  try {
    const payload = verifyAccessToken(header.slice('Bearer '.length).trim());
    return {
      isAuthorized: true,
      context: { userId: payload.userId, role: payload.role, email: payload.email },
    };
  } catch {
    return { isAuthorized: false };
  }
}
