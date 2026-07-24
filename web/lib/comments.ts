"use client";

import { authFetch } from "./auth";

// Comments admin API (server/routes/admin/comments.ts — editor+). Bearer via authFetch; 401 → login.

export type CommentStatus = "pending" | "approved" | "rejected";

export interface CommentRecord {
  _id: string;
  postId: string;
  authorName: string;
  authorEmail: string; // stored, shown to moderators only — never rendered on the public site
  body: string;
  status: CommentStatus;
  ip: string;
  createdAt: string;
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

/** Every comment, all statuses, newest first — the moderation queue derives its tabs client-side. */
export async function listComments(): Promise<CommentRecord[]> {
  return handle<CommentRecord[]>(await authFetch("/api/admin/comments"));
}

/** Approve → 'approved', Spam/Reject → 'rejected', Unapprove/Not-spam → 'pending'. */
export async function moderateComment(id: string, status: CommentStatus): Promise<CommentRecord> {
  return handle<CommentRecord>(
    await authFetch(`/api/admin/comments/${id}`, { method: "PUT", body: JSON.stringify({ status }) }),
  );
}

/** Permanent delete (the "move to trash → delete" path). */
export async function deleteComment(id: string): Promise<void> {
  await handle<{ message: string }>(await authFetch(`/api/admin/comments/${id}`, { method: "DELETE" }));
}
