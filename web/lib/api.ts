// Base URL of the Brandish Express API (server/). Set via NEXT_PUBLIC_API_URL; defaults to
// the local dev server. The admin app talks to this API cross-origin with a Bearer token.
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface ApiError extends Error {
  code?: string;
  status?: number;
}

/** Small wrapper: JSON in/out, throws an ApiError carrying the API's `{ error, code }` shape. */
export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = new Error((data.error as string) || `Request failed (${res.status})`) as ApiError;
    err.code = data.code as string | undefined;
    err.status = res.status;
    throw err;
  }
  return data as T;
}
