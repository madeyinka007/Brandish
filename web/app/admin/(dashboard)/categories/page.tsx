"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  listCategories,
  updateCategory,
  deleteCategory,
  type CategoryRecord,
} from "@/lib/categories";
import { CatStatusBadge, ColorDot, CAT_STATUS_META, type CatStatus } from "@/components/admin/category-ui";
import { formatDate } from "@/components/admin/user-ui";
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  Folder,
  GripVertical,
  MoreVertical,
  Plus,
  Star,
  Trash,
} from "@/components/admin/icons";

const PAGE_SIZE = 8;

type TabKey = "all" | CatStatus;
const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Visible" },
  { key: "hidden", label: "Hidden" },
];

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: (p: { width?: number; height?: number }) => React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
        <Icon width={18} height={18} />
      </span>
      <p className="mt-4 text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
    </div>
  );
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setCategories(await listCategories());
    } catch (e) {
      setError((e as Error).message || "Failed to load categories");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const counts = useMemo(() => {
    let active = 0;
    let hidden = 0;
    for (const c of categories) c.status === "active" ? active++ : hidden++;
    const newest = [...categories].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];
    return { total: categories.length, active, hidden, newest };
  }, [categories]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories.filter((c) => {
      if (tab !== "all" && c.status !== tab) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
      );
    });
  }, [categories, tab, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [tab, query]);

  async function toggleStatus(c: CategoryRecord) {
    setBusy(true);
    setMenuFor(null);
    try {
      await updateCategory(c._id, { status: c.status === "active" ? "hidden" : "active" });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: CategoryRecord) {
    setMenuFor(null);
    if (!window.confirm(`Delete “${c.name}”? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteCategory(c._id);
      await load();
    } catch (e) {
      // 409 CATEGORY_IN_USE has a friendly message from the API
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const rows = [
      ["Name", "Slug", "Status", "Updated"],
      ...filtered.map((c) => [c.name, c.slug, CAT_STATUS_META[c.status].label, formatDate(c.updatedAt)]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "brandish-categories.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6" onClick={() => setMenuFor(null)}>
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Categories</h1>
          <p className="mt-1 text-sm text-slate-500">
            Organise content into topics. Every category sits at the top level.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <Download width={16} height={16} /> Export CSV
          </button>
          <Link
            href="/admin/categories/new"
            className="flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
          >
            <Plus width={16} height={16} /> Add Category
          </Link>
        </div>
      </div>

      {/* stat cards (real counts) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Folder} label="Total Categories" value={String(counts.total)} sub="all statuses" tone="bg-brand-soft text-brand" />
        <StatCard icon={Eye} label="Visible" value={String(counts.active)} sub="shown on the site" tone="bg-emerald-50 text-emerald-600" />
        <StatCard icon={EyeOff} label="Hidden" value={String(counts.hidden)} sub="out of public nav" tone="bg-slate-100 text-slate-500" />
        <StatCard icon={Star} label="Newest" value={counts.newest?.name ?? "—"} sub="most recently added" tone="bg-amber-50 text-amber-600" />
      </div>

      {/* table card */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => {
              const n = t.key === "all" ? counts.total : t.key === "active" ? counts.active : counts.hidden;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    active ? "bg-brand-soft text-brand" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {t.label} <span className={active ? "text-brand" : "text-slate-400"}>{n}</span>
                </button>
              );
            })}
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories…"
            className="w-56 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
                <th className="w-8 px-4 py-2.5" />
                <th className="py-2.5 font-medium">Category</th>
                <th className="py-2.5 font-medium">Slug</th>
                <th className="py-2.5 font-medium">Posts</th>
                <th className="py-2.5 font-medium">Status</th>
                <th className="py-2.5 font-medium">Updated</th>
                <th className="w-10 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    Loading categories…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-rose-600">
                    {error}{" "}
                    <button onClick={() => void load()} className="ml-2 font-medium underline">
                      Retry
                    </button>
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    No categories match your filters.{" "}
                    <Link href="/admin/categories/new" className="font-medium text-brand hover:underline">
                      Add one
                    </Link>
                    .
                  </td>
                </tr>
              ) : (
                pageRows.map((c) => (
                  <tr key={c._id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-3 align-middle text-slate-300">
                      <GripVertical width={16} height={16} />
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <ColorDot color={c.color} />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-800">{c.name}</div>
                          {c.description && (
                            <div className="truncate text-xs text-slate-400">{c.description}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 font-mono text-xs text-slate-500">/{c.slug}</td>
                    <td className="py-3 text-slate-400">—</td>
                    <td className="py-3">
                      <CatStatusBadge status={c.status} />
                    </td>
                    <td className="py-3 text-slate-500">{formatDate(c.updatedAt)}</td>
                    <td className="relative py-3 pr-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuFor(menuFor === c._id ? null : c._id);
                        }}
                        aria-label="Row actions"
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      >
                        <MoreVertical width={16} height={16} />
                      </button>
                      {menuFor === c._id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-4 top-11 z-10 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg"
                        >
                          <button
                            onClick={() => toggleStatus(c)}
                            disabled={busy}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {c.status === "active" ? (
                              <>
                                <EyeOff width={15} height={15} /> Hide
                              </>
                            ) : (
                              <>
                                <CheckCircle width={15} height={15} /> Show
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => remove(c)}
                            disabled={busy}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                          >
                            <Trash width={15} height={15} /> Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && !error && filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>
              Showing {(pageClamped - 1) * PAGE_SIZE + 1}–
              {Math.min(pageClamped * PAGE_SIZE, filtered.length)} of {filtered.length} categories
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pageClamped === 1}
                className="rounded-md border border-slate-200 p-1.5 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft width={16} height={16} />
              </button>
              <span className="px-2">
                Page {pageClamped} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={pageClamped === totalPages}
                className="rounded-md border border-slate-200 p-1.5 disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight width={16} height={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
