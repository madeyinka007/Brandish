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
  body: unknown; // Tiptap JSON doc
  excerpt: string;
  format: PostFormat;
  coverImage: string;
  category: string; // category slug
  tags: string[];
  media: string[];
  videoId: string | null;
  keywords: string;
  ogImage: string;
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

/** Single post by id — read from the admin list (the API has no GET /:id). */
export async function getPost(id: string): Promise<PostRecord | null> {
  const all = await listPosts();
  return all.find((p) => p._id === id) ?? null;
}

export interface PostPayload {
  title: string;
  body?: unknown;
  excerpt?: string;
  format: PostFormat;
  coverImage?: string;
  category: string;
  tags?: string[];
  media?: string[];
  videoId?: string | null;
  keywords?: string;
  ogImage?: string;
  status?: PostStatus;
  publishedAt?: string | null;
}

export async function createPost(payload: PostPayload): Promise<PostRecord> {
  return handle<PostRecord>(await authFetch("/api/admin/posts", { method: "POST", body: JSON.stringify(payload) }));
}

export async function updatePost(id: string, payload: Partial<PostPayload>): Promise<PostRecord> {
  return handle<PostRecord>(await authFetch(`/api/admin/posts/${id}`, { method: "PUT", body: JSON.stringify(payload) }));
}

// ---- body (Tiptap doc) helpers ----
// The full rich editor isn't built yet; we store/read the body as a minimal Tiptap doc so it
// stays valid for the Next.js renderer. Plain text ⇄ paragraphs (blank line = new paragraph).

export function textToDoc(text: string): { type: "doc"; content: unknown[] } {
  const paras = text.split(/\n{2,}/).map((p) => p.trim());
  return {
    type: "doc",
    content: paras.map((p) => ({
      type: "paragraph",
      content: p ? [{ type: "text", text: p }] : [],
    })),
  };
}

export function docToText(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const doc = body as { content?: Array<{ content?: Array<{ text?: string }> }> };
  if (!Array.isArray(doc.content)) return "";
  return doc.content
    .map((node) => (Array.isArray(node.content) ? node.content.map((c) => c.text ?? "").join("") : ""))
    .join("\n\n")
    .trim();
}

// ---- video helpers ----
/** Extracts a YouTube video id from a URL (watch?v=, youtu.be/, embed/) or a raw 11-char id. */
export function extractYouTubeId(input: string): string {
  const s = input.trim();
  const m = s.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  return s;
}
