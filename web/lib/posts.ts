"use client";

import { authFetch } from "./auth";

// Posts admin API (server/routes/admin/posts.ts — editor+). Bearer via authFetch; 401 → login.

export type PostStatus = "draft" | "published" | "scheduled" | "archived";
export type PostFormat = "article" | "gallery" | "video";

export interface PostAuthor {
  _id: string;
  name: string;
  avatar?: string;
}

export interface PostRecord {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  format: PostFormat;
  coverImage: string;
  category: string; // category slug
  tags: string[];
  author: PostAuthor;
  status: PostStatus;
  viewCount: number;
  publishedAt: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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

/** All posts (every status/author), newest created first. Small dataset → fetch a full page. */
export async function listPosts(): Promise<PostRecord[]> {
  const res = await handle<Paginated<PostRecord>>(await authFetch("/api/admin/posts?limit=100"));
  return res.data;
}

export async function deletePost(id: string): Promise<void> {
  await handle<{ message: string }>(await authFetch(`/api/admin/posts/${id}`, { method: "DELETE" }));
}
