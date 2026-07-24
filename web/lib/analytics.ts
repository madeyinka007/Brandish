"use client";

import { authFetch } from "./auth";

// Analytics admin API (server/routes/admin/analytics.ts — editor+). Bearer via authFetch; 401 → login.

export interface Metric {
  value: number;
  deltaPct: number;
}

export interface AnalyticsOverview {
  rangeDays: number;
  range: { start: string; end: string };
  summary: {
    totalViews: Metric;
    uniqueVisitors: Metric;
    avgTimeOnPageSec: Metric;
    bounceRatePct: Metric;
  };
  timeseries: Array<{ date: string; views: number; unique: number }>;
  sources: Array<{ source: string; sessions: number; pct: number }>;
  devices: Array<{ device: string; sessions: number; pct: number }>;
  topPosts: Array<{
    postId: string;
    title: string;
    category: string;
    slug: string;
    views: number;
    avgTimeSec: number;
    bounceRatePct: number;
    changePct: number;
  }>;
  topCountries: Array<{ country: string; code: string; sessions: number; pct: number }>;
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

export async function getAnalytics(days = 30): Promise<AnalyticsOverview> {
  return handle<AnalyticsOverview>(await authFetch(`/api/admin/analytics?days=${days}`));
}
