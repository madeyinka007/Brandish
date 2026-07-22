"use client";

import { authFetch } from "./auth";

// Tags/Taxonomy admin API (server/routes/admin/tags.ts — editor+). Bearer via authFetch;
// a 401 bounces to login.

export interface TagRecord {
  _id: string;
  name: string;
  slug: string;
  description: string;
  color: string;
  postCount: number; // posts referencing this tag's slug (admin list only)
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

/** All tags, sorted by name. */
export async function listTags(): Promise<TagRecord[]> {
  return handle<TagRecord[]>(await authFetch("/api/admin/tags"));
}

export interface TagPayload {
  name?: string;
  description?: string;
  color?: string;
}

export async function createTag(payload: TagPayload): Promise<TagRecord> {
  return handle<TagRecord>(
    await authFetch("/api/admin/tags", { method: "POST", body: JSON.stringify(payload) }),
  );
}

/** Edits name/description/color — the slug is immutable server-side. */
export async function updateTag(id: string, payload: TagPayload): Promise<TagRecord> {
  return handle<TagRecord>(
    await authFetch(`/api/admin/tags/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  );
}

export async function deleteTag(id: string): Promise<void> {
  await handle<{ message: string }>(await authFetch(`/api/admin/tags/${id}`, { method: "DELETE" }));
}
