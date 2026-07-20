"use client";

import { authFetch } from "./auth";
import type { Role } from "@/components/admin/user-ui";

// Users admin API (server/routes/admin/users.ts — super-admin only). All calls carry the
// Bearer access token via authFetch; a 401 bounces to the login page.

export interface UserRecord {
  _id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
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

/** All users, newest first (limit 100 — plenty for the current dataset). */
export async function listUsers(): Promise<UserRecord[]> {
  return handle<UserRecord[]>(await authFetch("/api/admin/users?limit=100"));
}

/** Single user by id. The API has no GET /:id, so we read it from the list (small dataset). */
export async function getUser(id: string): Promise<UserRecord | null> {
  const users = await listUsers();
  return users.find((u) => u._id === id) ?? null;
}

/** Edits profile fields only (name / email / avatar). Role and status have their own calls. */
export async function updateUser(
  id: string,
  data: { name?: string; email?: string; avatar?: string },
): Promise<UserRecord> {
  return handle<UserRecord>(
    await authFetch(`/api/admin/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  );
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: Role;
  avatar?: string;
}

export async function createUser(payload: CreateUserPayload): Promise<UserRecord> {
  return handle<UserRecord>(
    await authFetch("/api/admin/users", { method: "POST", body: JSON.stringify(payload) }),
  );
}

export async function setUserStatus(id: string, active: boolean): Promise<UserRecord> {
  return handle<UserRecord>(
    await authFetch(`/api/admin/users/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ active }),
    }),
  );
}

export async function assignRole(id: string, role: Role): Promise<UserRecord> {
  return handle<UserRecord>(
    await authFetch(`/api/admin/users/${id}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    }),
  );
}

export async function deleteUser(id: string): Promise<void> {
  await handle<{ message: string }>(
    await authFetch(`/api/admin/users/${id}`, { method: "DELETE" }),
  );
}
