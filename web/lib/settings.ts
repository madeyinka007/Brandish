"use client";

import { authFetch } from "./auth";

// Settings admin API (server/routes/admin/settings.ts). Read is editor+, write is super-admin.

export type ThemeMode = "light" | "dark" | "auto";
export type ContentWidth = "narrow" | "standard" | "wide";
export type PostListsShow = "excerpt" | "full";
export type WhoCanComment = "anyone" | "subscribers" | "closed";

export interface SiteSettings {
  title: string;
  logoUrl: string;
  tagline: string;
  description: string;
  language: string;
  timezone: string;
  postsPerPage: number;
  showAuthorBylines: boolean;
  enableComments: boolean;
  enableRss: boolean;
  maintenanceMode: boolean;
}
export interface AppearanceSettings {
  theme: ThemeMode;
  accentColor: string;
  headingFont: string;
  bodyFont: string;
  contentWidth: ContentWidth;
  showCoverImages: boolean;
  stickyNav: boolean;
}
export interface ReadingSettings {
  postListsShow: PostListsShow;
  excerptWords: number;
  rssItems: number;
  showReadingTime: boolean;
  showAuthorBio: boolean;
  showRelatedPosts: boolean;
}
export interface CommentSettings {
  whoCanComment: WhoCanComment;
  nestingDepth: number;
  holdForModeration: boolean;
  autoCloseComments: boolean;
  emailOnNewComment: boolean;
  requireRecaptcha: boolean;
}
export interface Settings {
  site: SiteSettings;
  appearance: AppearanceSettings;
  reading: ReadingSettings;
  comments: CommentSettings;
  updatedAt: string | null;
  updatedBy: string | null;
}

export type SettingsPatch = {
  site?: Partial<SiteSettings>;
  appearance?: Partial<AppearanceSettings>;
  reading?: Partial<ReadingSettings>;
  comments?: Partial<CommentSettings>;
};

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

export async function getSettings(): Promise<Settings> {
  return handle<Settings>(await authFetch("/api/admin/settings"));
}

/** Partial patch — send only the section(s) that changed; the server deep-merges. Super-admin. */
export async function updateSettings(patch: SettingsPatch): Promise<Settings> {
  return handle<Settings>(await authFetch("/api/admin/settings", { method: "PUT", body: JSON.stringify(patch) }));
}
