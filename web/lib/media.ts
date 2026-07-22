"use client";

import { authFetch } from "./auth";

// Media admin API (server/routes/admin/media.ts + upload-url.ts — editor+). The `media`
// collection is native-driver. Bearer via authFetch; a 401 bounces to login.

export interface MediaRecord {
  _id: string;
  source: "upload" | "url";
  filename: string | null;
  url: string;
  size: number | null;
  mimeType: string | null;
  uploadedBy: string;
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

/** Media library, newest first (limit high — the dataset is small for now). */
export async function listMedia(): Promise<MediaRecord[]> {
  return handle<MediaRecord[]>(await authFetch("/api/admin/media?limit=100"));
}

/** Registers an already-hosted image by URL. The server validates it (SSRF guard) — no AWS needed. */
export async function createFromUrl(url: string): Promise<MediaRecord> {
  return handle<MediaRecord>(
    await authFetch("/api/admin/media", { method: "POST", body: JSON.stringify({ source: "url", url }) }),
  );
}

export async function deleteMedia(id: string): Promise<void> {
  await handle<{ message: string }>(await authFetch(`/api/admin/media/${id}`, { method: "DELETE" }));
}

interface PresignedUpload {
  uploadUrl: string;
  cdnUrl: string;
  key: string;
}

/**
 * Full direct-to-S3 upload flow (needs S3/AWS configured — works in production):
 *   1. GET a presigned PUT URL + the CloudFront URL the object will serve from
 *   2. PUT the file straight to S3 (never through the API)
 *   3. POST the media record ({ source: 'upload', url: cdnUrl, ... })
 */
export async function uploadFile(file: File): Promise<MediaRecord> {
  const presigned = await handle<PresignedUpload>(
    await authFetch(
      `/api/admin/upload-url?filename=${encodeURIComponent(file.name)}&type=${encodeURIComponent(file.type || "application/octet-stream")}`,
    ),
  );

  const put = await fetch(presigned.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!put.ok) {
    const err = new Error(`Upload to storage failed (${put.status})`) as ApiError;
    err.status = put.status;
    throw err;
  }

  return handle<MediaRecord>(
    await authFetch("/api/admin/media", {
      method: "POST",
      body: JSON.stringify({
        source: "upload",
        filename: file.name,
        url: presigned.cdnUrl,
        size: file.size,
        mimeType: file.type || null,
      }),
    }),
  );
}
