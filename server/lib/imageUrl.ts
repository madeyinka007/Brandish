import { lookup } from 'dns/promises';

// Validates that a user-supplied URL is a safe, reachable image before the server ever
// fetches or stores it. This is an SSRF guard: without it, an unguarded server-side fetch
// of a user-controlled URL lets an attacker reach the Lambda's own metadata endpoint or
// internal AWS services (see docs/workflows.md). Do not weaken it.

const HEAD_TIMEOUT_MS = 5000;

export interface ImageUrlResult {
  ok: boolean;
  mimeType?: string;
  reason?: string;
}

/** True for loopback / private / link-local / CGNAT / unique-local ranges — anything an
 *  outbound request should never be allowed to reach. Unparseable input is treated as unsafe. */
export function isPrivateAddress(ip: string): boolean {
  // IPv4-mapped IPv6 (::ffff:1.2.3.4) — classify by the embedded IPv4.
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(ip);
  if (mapped) return isPrivateIPv4(mapped[1]);
  if (ip.includes(':')) return isPrivateIPv6(ip);
  return isPrivateIPv4(ip);
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return true; // unparseable → treat as unsafe
  }
  const [a, b] = parts;
  if (a === 0) return true;                          // 0.0.0.0/8
  if (a === 10) return true;                         // 10.0.0.0/8 private
  if (a === 127) return true;                        // loopback
  if (a === 169 && b === 254) return true;           // link-local (169.254.169.254 = metadata!)
  if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true;           // 192.168.0.0/16 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const addr = ip.toLowerCase();
  if (addr === '::1' || addr === '::') return true; // loopback / unspecified
  if (addr.startsWith('fe80')) return true;         // link-local
  if (addr.startsWith('fc') || addr.startsWith('fd')) return true; // fc00::/7 unique-local
  return false;
}

export async function validateImageUrl(url: string): Promise<ImageUrlResult> {
  // 1. Parse + http(s)-only.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'malformed URL' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'protocol must be http(s)' };
  }

  // 2. Resolve the hostname and reject if ANY resolved address is private/loopback/etc.
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(parsed.hostname, { all: true });
  } catch {
    return { ok: false, reason: 'host does not resolve' };
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    return { ok: false, reason: 'host resolves to a private/loopback address' };
  }

  // 3. HEAD the URL (short timeout, redirects disallowed so a 3xx can't bounce to a private
  //    host), require a 2xx and an image/* Content-Type.
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEAD_TIMEOUT_MS);
    timer.unref(); // don't let the abort timer keep the Lambda (or a Jest worker) alive
    let res: Response;
    try {
      res = await fetch(url, { method: 'HEAD', redirect: 'error', signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return { ok: false, reason: `non-2xx response (${res.status})` };
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) return { ok: false, reason: 'not an image' };
    return { ok: true, mimeType: contentType.split(';')[0].trim() };
  } catch {
    return { ok: false, reason: 'HEAD request failed' };
  }
}
