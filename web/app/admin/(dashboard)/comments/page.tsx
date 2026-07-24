"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  listComments,
  moderateComment,
  deleteComment,
  type CommentRecord,
  type CommentStatus,
  type ApiError,
} from "@/lib/comments";
import { listPosts, type PostRecord } from "@/lib/posts";
import { BADGE_REFRESH_EVENT } from "@/components/admin/Sidebar";
import { Avatar, formatDate } from "@/components/admin/user-ui";
import {
  Ban,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  MessageSquare,
  Trash,
} from "@/components/admin/icons";

const PAGE_SIZE = 8;

type Tab = "all" | "pending" | "approved" | "rejected";

const STATUS_META: Record<CommentStatus, { label: string; badge: string; bar: string }> = {
  pending: { label: "Pending", badge: "bg-amber-50 text-amber-700", bar: "border-l-amber-400" },
  approved: { label: "Approved", badge: "bg-emerald-50 text-emerald-700", bar: "border-l-emerald-400" },
  rejected: { label: "Spam", badge: "bg-rose-50 text-rose-700", bar: "border-l-rose-400" },
};

/** Compact "2 days ago" style relative time; falls back to the absolute date past ~30 days. */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.floor((Date.now() - then) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  return formatDate(iso);
}

function messageFor(err: ApiError): string {
  if (err.code === "COMMENT_NOT_FOUND") return "That comment no longer exists.";
  if (err.status === 500) return "The server couldn't complete that. Please try again.";
  return err.message || "Something went wrong.";
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
      <p className="mt-1 truncate text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
    </div>
  );
}

export default function CommentsPage() {
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [posts, setPosts] = useState<Map<string, PostRecord>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("pending");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [rows, postList] = await Promise.all([listComments(), listPosts().catch(() => [])]);
      setComments(rows);
      setPosts(new Map(postList.map((p) => [p._id, p])));
      setSelected(new Set());
      // Nudge the sidebar's pending badge to re-count after moderation.
      if (typeof window !== "undefined") window.dispatchEvent(new Event(BADGE_REFRESH_EVENT));
    } catch (e) {
      setError((e as Error).message || "Failed to load comments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const counts = useMemo(() => {
    const c = { all: comments.length, pending: 0, approved: 0, rejected: 0 };
    for (const cm of comments) c[cm.status] += 1;
    return c;
  }, [comments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = comments.filter((c) => {
      if (tab !== "all" && c.status !== tab) return false;
      if (!q) return true;
      const post = posts.get(c.postId);
      return (
        c.authorName.toLowerCase().includes(q) ||
        c.authorEmail.toLowerCase().includes(q) ||
        c.body.toLowerCase().includes(q) ||
        (post?.title.toLowerCase().includes(q) ?? false)
      );
    });
    return [...list].sort((a, b) => {
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sort === "newest" ? diff : -diff;
    });
  }, [comments, posts, query, tab, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query, tab, sort]);

  const visibleIds = pageRows.map((c) => c._id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function runOne(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(messageFor(e as ApiError));
      setBusy(false);
    }
  }

  const setStatus = (id: string, status: CommentStatus) => runOne(() => moderateComment(id, status));
  const remove = (id: string) =>
    runOne(async () => {
      await deleteComment(id);
      setConfirmDelete(null);
    });

  async function bulk(action: "approve" | "reject" | "delete") {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await Promise.all(
        ids.map((id) =>
          action === "delete" ? deleteComment(id) : moderateComment(id, action === "approve" ? "approved" : "rejected"),
        ),
      );
      await load();
    } catch (e) {
      setError(messageFor(e as ApiError));
      setBusy(false);
    }
  }

  function exportCsv() {
    const rows = [
      ["Author", "Email", "Status", "Post", "Comment", "IP", "Date"],
      ...filtered.map((c) => [
        c.authorName,
        c.authorEmail,
        c.status,
        posts.get(c.postId)?.title ?? c.postId,
        c.body,
        c.ip,
        formatDate(c.createdAt),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "brandish-comments.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const tabs: { key: Tab; label: string; n: number }[] = [
    { key: "pending", label: "Pending", n: counts.pending },
    { key: "approved", label: "Approved", n: counts.approved },
    { key: "rejected", label: "Spam", n: counts.rejected },
    { key: "all", label: "All", n: counts.all },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Comments</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review and moderate reader comments across every post.
          </p>
        </div>
        <button
          onClick={exportCsv}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <Download width={16} height={16} /> Export CSV
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* stat cards (real, derived) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Clock} label="Pending Review" value={String(counts.pending)} sub="awaiting moderation" tone="bg-amber-50 text-amber-600" />
        <StatCard icon={CheckCircle} label="Approved" value={String(counts.approved)} sub="live on the site" tone="bg-emerald-50 text-emerald-600" />
        <StatCard icon={Ban} label="Marked Spam" value={String(counts.rejected)} sub="hidden from readers" tone="bg-rose-50 text-rose-600" />
        <StatCard icon={MessageSquare} label="Total Comments" value={String(counts.all)} sub="across all posts" tone="bg-brand-soft text-brand" />
      </div>

      {/* toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div className="flex flex-wrap gap-1">
            {tabs.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    active ? "bg-brand-soft text-brand" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {t.label} <span className={active ? "text-brand" : "text-slate-400"}>{t.n}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search author, text or post…"
              className="w-56 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "newest" | "oldest")}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        </div>

        {/* bulk bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleAllVisible}
              disabled={pageRows.length === 0}
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            {selected.size > 0 ? (
              <span className="font-medium text-slate-700">{selected.size} selected</span>
            ) : (
              <span>Select all on page</span>
            )}
          </label>
          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <button onClick={() => bulk("approve")} disabled={busy} className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
                <Check width={14} height={14} /> Approve
              </button>
              <button onClick={() => bulk("reject")} disabled={busy} className="flex items-center gap-1 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50">
                <Ban width={14} height={14} /> Mark spam
              </button>
              <button onClick={() => bulk("delete")} disabled={busy} className="flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                <Trash width={14} height={14} /> Delete
              </button>
            </div>
          )}
        </div>

        {/* list */}
        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="px-4 py-16 text-center text-slate-400">Loading comments…</div>
          ) : pageRows.length === 0 ? (
            <div className="px-4 py-16 text-center text-slate-400">
              {comments.length === 0 ? "No comments yet." : "No comments match this view."}
            </div>
          ) : (
            pageRows.map((c) => {
              const meta = STATUS_META[c.status];
              const post = posts.get(c.postId);
              const isDeleting = confirmDelete === c._id;
              return (
                <div key={c._id} className={`border-l-2 ${meta.bar} ${selected.has(c._id) ? "bg-brand-soft/30" : ""}`}>
                  <div className="flex gap-3 px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selected.has(c._id)}
                      onChange={() => toggle(c._id)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-brand focus:ring-brand"
                    />
                    <Avatar name={c.authorName} size={36} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{c.authorName}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.badge}`}>{meta.label}</span>
                        <span className="ml-auto text-xs text-slate-400">{timeAgo(c.createdAt)}</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {c.authorEmail}
                        {c.ip ? ` · ${c.ip}` : ""}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-slate-700">{c.body}</p>

                      <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
                        <FileText width={13} height={13} />
                        {post ? (
                          <Link href={`/${post.category}/${post.slug}`} className="text-brand hover:underline" target="_blank">
                            {post.title}
                          </Link>
                        ) : (
                          <span className="italic">post unavailable</span>
                        )}
                      </div>

                      {/* actions */}
                      {isDeleting ? (
                        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                          <span className="text-sm text-slate-700">Delete this comment permanently?</span>
                          <div className="ml-auto flex gap-2">
                            <button onClick={() => setConfirmDelete(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Keep</button>
                            <button onClick={() => remove(c._id)} disabled={busy} className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">Delete</button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {c.status !== "approved" && (
                            <button onClick={() => setStatus(c._id, "approved")} disabled={busy} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">
                              <Check width={14} height={14} /> Approve
                            </button>
                          )}
                          {c.status === "approved" && (
                            <button onClick={() => setStatus(c._id, "pending")} disabled={busy} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
                              <Clock width={14} height={14} /> Unapprove
                            </button>
                          )}
                          {c.status !== "rejected" && (
                            <button onClick={() => setStatus(c._id, "rejected")} disabled={busy} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50">
                              <Ban width={14} height={14} /> Spam
                            </button>
                          )}
                          <button onClick={() => setConfirmDelete(c._id)} disabled={busy} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50">
                            <Trash width={14} height={14} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>
              Showing {(pageClamped - 1) * PAGE_SIZE + 1}–{Math.min(pageClamped * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
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
