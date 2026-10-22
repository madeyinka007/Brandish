"use client";

import { API_URL } from "./api";
import { authFetch, getAccessToken } from "./auth";

// Subscribers admin API (server/routes/admin/subscribers.ts — editor+). Bearer via authFetch;
// a 401 bounces to login.

export type SubscriberStatus = "pending" | "subscribed" | "unsubscribed";

export interface SubscriberRecord {
  _id: string;
  email: string;
  status: SubscriberStatus;
  confirmedAt: string | null;
  source: string;
  categories: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SubscriberList {
  data: SubscriberRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  counts: { all: number; pending: number; subscribed: number; unsubscribed: number };
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

/** One page of subscribers, newest first, with the per-status totals for the stat cards. */
export async function listSubscribers(params: {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
} = {}): Promise<SubscriberList> {
  const query = new URLSearchParams();
  if (params.status && params.status !== "all") query.set("status", params.status);
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return handle<SubscriberList>(await authFetch(`/api/admin/subscribers${qs ? `?${qs}` : ""}`));
}

/** Re-issues the confirmation token and re-sends the opt-in email. */
export async function resendConfirmation(id: string): Promise<{ message: string }> {
  return handle<{ message: string }>(
    await authFetch(`/api/admin/subscribers/${id}/resend`, { method: "POST" }),
  );
}

/** Permanent delete (the admin's "remove this subscriber" action). */
export async function deleteSubscriber(id: string): Promise<void> {
  await handle<{ message: string }>(await authFetch(`/api/admin/subscribers/${id}`, { method: "DELETE" }));
}

/**
 * The CSV export is a file download, so it can't go through `handle` (which parses JSON).
 * Fetch it with the Bearer token and hand the browser a blob URL instead.
 */
export async function downloadSubscribersCsv(params: { status?: string; search?: string } = {}): Promise<void> {
  const query = new URLSearchParams();
  if (params.status && params.status !== "all") query.set("status", params.status);
  if (params.search) query.set("search", params.search);
  const qs = query.toString();

  const token = getAccessToken();
  const res = await fetch(`${API_URL}/api/admin/subscribers/export${qs ? `?${qs}` : ""}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(`Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "brandish-subscribers.csv";
  a.click();
  URL.revokeObjectURL(url);
}
