"use client";

import { useEffect, useMemo, useState } from "react";
import { listPosts, deletePost, type PostRecord, type PostStatus, type ApiError } from "@/lib/posts";
import { listCategories, type CategoryRecord } from "@/lib/categories";
import { Avatar, formatDate } from "@/components/admin/user-ui";
import { ColorDot } from "@/components/admin/category-ui";
import { gradientFor } from "@/components/admin/media-ui";
import { API_URL } from "@/lib/api";
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  FileText,
  ImageIcon,
  MoreVertical,
  Pencil,
  Plus,
  Trash,
} from "@/components/admin/icons";

const PAGE_SIZE = 8;

type TabKey = "all" | PostStatus;
const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Draft" },
  { key: "scheduled", label: "Scheduled" },
  { key: "archived", label: "Archived" },
];

const STATUS_META: Record<PostStatus, { label: string; badge: string }> = {
  published: { label: "Published", badge: "bg-emerald-50 text-emerald-700" },
  draft: { label: "Draft", badge: "bg-slate-100 text-slate-600" },
  scheduled: { label: "Scheduled", badge: "bg-blue-50 text-blue-700" },
  archived: { label: "Archived", badge: "bg-slate-100 text-slate-500" },
};

function formatViews(n: number): string {
  if (!n) return "—";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "") + "K";
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
}

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

function Thumb({ post }: { post: PostRecord }) {
  if (post.coverImage) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={post.coverImage} alt="" className="h-full w-full object-cover" loading="lazy" />;
  }
  return (
    <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradientFor(post.title || post.slug)}`}>
      <ImageIcon width={16} height={16} className="text-white/80" />
    </div>
  );
}

export default function PostsPage() {
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [catMap, setCatMap] = useState<Map<string, CategoryRecord>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [tab, setTab] = useState<TabKey>("all");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [p, cats] = await Promise.all([listPosts(), listCategories().catch(() => [] as CategoryRecord[])]);
      setPosts(p);
      setCatMap(new Map(cats.map((c) => [c.slug, c])));
    } catch (e) {
      setError((e as Error).message || "Failed to load posts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const counts = useMemo(() => {
    const by: Record<PostStatus, number> = { published: 0, draft: 0, scheduled: 0, archived: 0 };
    for (const p of posts) by[p.status]++;
    return { total: posts.length, ...by };
  }, [posts]);

  const categoriesInUse = useMemo(() => {
    const set = new Set(posts.map((p) => p.category).filter(Boolean));
    return [...set].sort();
  }, [posts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((p) => {
      if (tab !== "all" && p.status !== tab) return false;
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.author?.name?.toLowerCase().includes(q) ||
        p.tags?.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [posts, tab, categoryFilter, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [tab, query, categoryFilter]);

  const pageIds = pageRows.map((p) => p._id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function categoryLabel(slug: string): string {
    return catMap.get(slug)?.name ?? (slug ? slug : "Uncategorised");
  }

  async function doDelete(ids: string[]) {
    const label = ids.length === 1 ? "this post" : `${ids.length} posts`;
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    setBusy(true);
    setMenuFor(null);
    try {
      await Promise.all(ids.map((id) => deletePost(id)));
      await load();
      setSelected(new Set());
      setNotice(`Deleted ${label}.`);
    } catch (e) {
      setError((e as ApiError).message || "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  function copyLink(p: PostRecord) {
    setMenuFor(null);
    void navigator.clipboard?.writeText(`${API_URL}/${p.category}/${p.slug}`);
    setNotice("Post link copied.");
  }

  function exportCsv() {
    const rows = [
      ["Title", "Slug", "Author", "Category", "Status", "Views", "Created"],
      ...filtered.map((p) => [
        p.title,
        p.slug,
        p.author?.name ?? "",
        categoryLabel(p.category),
        STATUS_META[p.status].label,
        String(p.viewCount ?? 0),
        formatDate(p.createdAt),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "brandish-posts.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6" onClick={() => setMenuFor(null)}>
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Posts</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every article across Brandish — drafts, scheduled pieces and everything published.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <Download width={16} height={16} /> Export CSV
          </button>
          <button
            onClick={() => setNotice("The post editor isn’t built yet — this page lists and manages existing posts.")}
            title="Post editor coming soon"
            className="flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
          >
            <Plus width={16} height={16} /> New Post
          </button>
        </div>
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {notice}
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}
      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {/* stat cards (real counts) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FileText} label="Total Posts" value={String(counts.total)} sub="all statuses" tone="bg-brand-soft text-brand" />
        <StatCard icon={CheckCircle} label="Published" value={String(counts.published)} sub="live on the site" tone="bg-emerald-50 text-emerald-600" />
        <StatCard icon={Pencil} label="Drafts" value={String(counts.draft)} sub="not yet published" tone="bg-slate-100 text-slate-500" />
        <StatCard icon={Clock} label="Scheduled" value={String(counts.scheduled)} sub="queued to publish" tone="bg-blue-50 text-blue-600" />
      </div>

      {/* table card */}
      <div className="rounded-xl border border-slate-200 bg-white">
        {/* tabs + filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => {
              const n = t.key === "all" ? counts.total : counts[t.key];
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
          <div className="flex items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600"
            >
              <option value="all">All categories</option>
              {categoriesInUse.map((slug) => (
                <option key={slug} value={slug}>
                  {categoryLabel(slug)}
                </option>
              ))}
            </select>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search posts…"
              className="w-44 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20"
            />
          </div>
        </div>

        {/* bulk bar */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-brand-soft/50 px-4 py-2.5">
            <span className="text-sm font-medium text-slate-700">{selected.size} selected</span>
            <button
              onClick={() => doDelete([...selected])}
              disabled={busy}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >
              Delete selected
            </button>
          </div>
        )}

        {/* table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
                <th className="w-10 px-4 py-2.5">
                  <input type="checkbox" checked={allOnPageSelected} onChange={toggleAll} aria-label="Select all on page" className="h-4 w-4 rounded border-slate-300 accent-[color:var(--color-brand)]" />
                </th>
                <th className="py-2.5 font-medium">Post</th>
                <th className="py-2.5 font-medium">Author</th>
                <th className="py-2.5 font-medium">Category</th>
                <th className="py-2.5 font-medium">Status</th>
                <th className="py-2.5 font-medium">Views</th>
                <th className="py-2.5 font-medium">Created</th>
                <th className="w-10 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Loading posts…</td></tr>
              ) : error ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-rose-600">{error} <button onClick={() => void load()} className="ml-2 font-medium underline">Retry</button></td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">{posts.length === 0 ? "No posts yet." : "No posts match your filters."}</td></tr>
              ) : (
                pageRows.map((p) => (
                  <tr key={p._id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(p._id)} onChange={() => toggleOne(p._id)} aria-label={`Select ${p.title}`} className="h-4 w-4 rounded border-slate-300 accent-[color:var(--color-brand)]" />
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-14 shrink-0 overflow-hidden rounded-md bg-slate-100">
                          <Thumb post={p} />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-800">{p.title || "Untitled"}</div>
                          <div className="truncate font-mono text-xs text-slate-400">/{p.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={p.author?.name || "?"} src={p.author?.avatar} size={26} />
                        <span className="truncate text-slate-600">{p.author?.name ?? "Deleted author"}</span>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        <ColorDot color={catMap.get(p.category)?.color} size={7} />
                        {categoryLabel(p.category)}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_META[p.status].badge}`}>
                        {STATUS_META[p.status].label}
                      </span>
                    </td>
                    <td className="py-3 text-slate-600">{formatViews(p.viewCount)}</td>
                    <td className="py-3 text-slate-500">{formatDate(p.createdAt)}</td>
                    <td className="relative py-3 pr-4 text-right">
                      <button onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === p._id ? null : p._id); }} aria-label="Row actions" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                        <MoreVertical width={16} height={16} />
                      </button>
                      {menuFor === p._id && (
                        <div onClick={(e) => e.stopPropagation()} className="absolute right-4 top-11 z-10 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg">
                          <button onClick={() => copyLink(p)} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                            <Copy width={15} height={15} /> Copy link
                          </button>
                          <button onClick={() => doDelete([p._id])} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50">
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

        {/* pagination */}
        {!loading && !error && filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>Showing {(pageClamped - 1) * PAGE_SIZE + 1}–{Math.min(pageClamped * PAGE_SIZE, filtered.length)} of {filtered.length} posts</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pageClamped === 1} className="rounded-md border border-slate-200 p-1.5 disabled:opacity-40" aria-label="Previous page">
                <ChevronLeft width={16} height={16} />
              </button>
              <span className="px-2">Page {pageClamped} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={pageClamped === totalPages} className="rounded-md border border-slate-200 p-1.5 disabled:opacity-40" aria-label="Next page">
                <ChevronRight width={16} height={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
