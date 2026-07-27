"use client";

import { authFetch, updateStoredUser, type AdminUser } from "./auth";

// Self-service profile API (server/routes/auth.ts — /me + change-password). Any signed-in user.

export interface Me {
  _id: string;
  name: string;
  firstName: string;
  lastName: string;
  bio: string;
  email: string;
  avatar: string;
  role: AdminUser["role"];
  active: boolean;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiError extends Error {
  code?: string;
  status?: number;
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/admin/login";
    throw new Error("Session expired");
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = new Error((data.error as string) || `Request failed (${res.status})`) as ApiError;
    err.code = data.code as string | undefined;
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export async function getMe(): Promise<Me> {
  return handle<Me>(await authFetch("/api/auth/me"));
}

export interface ProfilePatch {
  name?: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  email?: string;
  avatar?: string;
}

export async function updateProfile(patch: ProfilePatch): Promise<Me> {
  const me = await handle<Me>(await authFetch("/api/auth/me", { method: "PUT", body: JSON.stringify(patch) }));
  // Reflect name/avatar/email into the cached session so the sidebar + topbar update immediately.
  updateStoredUser({ name: me.name, avatar: me.avatar, email: me.email });
  return me;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await handle<{ message: string }>(
    await authFetch("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  );
}
