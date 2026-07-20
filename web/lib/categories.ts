"use client";

import { authFetch } from "./auth";
import type { CatStatus } from "@/components/admin/category-ui";

// Categories admin API (server/routes/admin/categories.ts — editor+). Bearer via authFetch;
// a 401 bounces to login.

export interface CategorySeo {
  title: string;
  description: string;
  keywords: string;
  ogImage: string;
}

export interface CategoryRecord {
  _id: string;
  name: string;
  slug: string;
  description: string;
  color: string;
  order: number;
  status: CatStatus;
  seo: CategorySeo;
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

/** All categories (every status), ordered by `order` then name. */
export async function listCategories(): Promise<CategoryRecord[]> {
  return handle<CategoryRecord[]>(await authFetch("/api/admin/categories"));
}

export interface CreateCategoryPayload {
  name: string;
  description?: string;
  color?: string;
  status?: CatStatus;
  order?: number;
  seo?: Partial<CategorySeo>;
}

export async function createCategory(payload: CreateCategoryPayload): Promise<CategoryRecord> {
  return handle<CategoryRecord>(
    await authFetch("/api/admin/categories", { method: "POST", body: JSON.stringify(payload) }),
  );
}

/** Edits name/description/color/order/status/seo — never the slug (server keeps it immutable). */
export async function updateCategory(
  id: string,
  data: Partial<Omit<CreateCategoryPayload, "name"> & { name: string }>,
): Promise<CategoryRecord> {
  return handle<CategoryRecord>(
    await authFetch(`/api/admin/categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  );
}

export async function deleteCategory(id: string): Promise<void> {
  await handle<{ message: string }>(
    await authFetch(`/api/admin/categories/${id}`, { method: "DELETE" }),
  );
}
