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

/** Authenticated fetch to the API — attaches the Bearer access token. */
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
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
