"use client";

import { API_URL, type ApiError } from "./api";

// Client-side auth for the admin app. The API owns auth (custom JWT — see docs/auth.md):
// POST /api/auth/login returns { accessToken, refreshToken, user }. We stash them in
// localStorage and attach the access token as a Bearer header on admin requests. The API's
// Lambda authorizer + requireRole are the real security boundary; this is just UX/session.

const ACCESS_KEY = "brandish_access_token";
const REFRESH_KEY = "brandish_refresh_token";
const USER_KEY = "brandish_user";

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: "super-admin" | "editor" | "author" | "reader";
  avatar?: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AdminUser;
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getStoredUser(): AdminUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  try {
    return raw ? (JSON.parse(raw) as AdminUser) : null;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

function persist(data: LoginResponse): void {
  localStorage.setItem(ACCESS_KEY, data.accessToken);
  localStorage.setItem(REFRESH_KEY, data.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
}

function clear(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

/** Authenticates against the API. Throws an ApiError (with `.code`/`.status`) on failure. */
export async function login(email: string, password: string): Promise<AdminUser> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = new Error((data.error as string) || "Unable to sign in") as ApiError;
    err.code = data.code as string | undefined;
    err.status = res.status;
    throw err;
  }
  const payload = data as unknown as LoginResponse;
  persist(payload);
  return payload.user;
}

/** Revokes the refresh token server-side (best-effort) and clears local session. */
export async function logout(): Promise<void> {
  const refreshToken = typeof window !== "undefined" ? localStorage.getItem(REFRESH_KEY) : null;
  try {
    if (refreshToken) {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
    }
  } catch {
    /* best-effort — clear locally regardless */
  } finally {
    clear();
  }
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

function requestWithToken(path: string, init: RequestInit): Promise<Response> {
  const token = getAccessToken();
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
}

// Exchanges the stored refresh token for a new pair (rotation) and persists them. Shared
// in-flight promise so several concurrent 401s trigger exactly one refresh — important
// because refresh tokens are single-use (rotated), so parallel refreshes would clobber
// each other. Returns false if there's no refresh token or the server rejects it.
let refreshInFlight: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => ({}))) as { accessToken?: string; refreshToken?: string };
    if (!data.accessToken || !data.refreshToken) return false;
    localStorage.setItem(ACCESS_KEY, data.accessToken);
    localStorage.setItem(REFRESH_KEY, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

function refreshOnce(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/**
 * Authenticated fetch to the API. Attaches the Bearer access token; on a `401` (access token
 * expired — it's short-lived) it transparently refreshes via `/api/auth/refresh` and retries
 * once. Only if the refresh itself fails does it clear the session — so callers redirect to
 * login solely on a genuinely dead session, not on a routine expiry.
 */
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await requestWithToken(path, init);
  if (res.status !== 401) return res;

  const refreshed = await refreshOnce();
  if (!refreshed) {
    clear(); // session is truly dead — presence check now returns false, so login won't bounce
    return res;
  }
  return requestWithToken(path, init); // retry once with the fresh access token
}
