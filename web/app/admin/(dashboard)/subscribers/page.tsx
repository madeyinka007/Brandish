"use client";

import { useEffect, useState } from "react";
import {
  deleteSubscriber,
  downloadSubscribersCsv,
  listSubscribers,
  resendConfirmation,
  type ApiError,
  type SubscriberRecord,
  type SubscriberStatus,
} from "@/lib/subscribers";
import { formatDate } from "@/components/admin/user-ui";
import {
  Ban,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Mail,
  Send,
  Trash,
  Users,
} from "@/components/admin/icons";

const PAGE_SIZE = 20;

type Tab = "all" | SubscriberStatus;

const STATUS_META: Record<SubscriberStatus, { label: string; badge: string; bar: string }> = {
  pending: { label: "Pending", badge: "bg-amber-50 text-amber-700", bar: "border-l-amber-400" },
  subscribed: { label: "Subscribed", badge: "bg-emerald-50 text-emerald-700", bar: "border-l-emerald-400" },
  unsubscribed: { label: "Unsubscribed", badge: "bg-slate-100 text-slate-500", bar: "border-l-slate-300" },
};

const SOURCE_LABEL: Record<string, string> = {
  footer: "Footer",
  sidebar: "Sidebar",
};

function messageFor(err: ApiError): string {
  if (err.code === "SUBSCRIBER_NOT_FOUND") return "That subscriber no longer exists.";
  if (err.code === "CONFIRMATION_EMAIL_FAILED") return "The confirmation email could not be sent. Check the SES configuration.";
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

export default function SubscribersPage() {
  // The list is filtered and paged by the API, not in the browser — the audience grows past
  // what a single response can carry, so the server owns the page window and the totals.
  const [rows, setRows] = useState<SubscriberRecord[]>([]);
  const [counts, setCounts] = useState({ all: 0, pending: 0, subscribed: 0, unsubscribed: 0 });
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function load(next: { status?: string; search?: string; page?: number } = {}) {
    setLoading(true);
    setError(null);
    try {
      const result = await listSubscribers({
        status: next.status ?? tab,
        search: next.search ?? query.trim(),
        page: next.page ?? page,
        limit: PAGE_SIZE,
      });
      setRows(result.data);
      setCounts(result.counts);
      setTotal(result.total);
      setTotalPages(Math.max(1, result.totalPages));
    } catch (e) {
      setError((e as Error).message || "Failed to load subscribers");
    } finally {
      setLoading(false);
    }
  }

  // Debounced search — one request per pause in typing, not one per keystroke.
  useEffect(() => {
    const id = setTimeout(() => {
      setPage(1);
      void load({ search: query.trim(), page: 1 });
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page]);

  async function runOne(fn: () => Promise<unknown>, successMessage?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      if (successMessage) setNotice(successMessage);
      await load();
    } catch (e) {
      setError(messageFor(e as ApiError));
    } finally {
      setBusy(false);
    }
  }

  function remove(id: string) {
    return runOne(async () => {
      await deleteSubscriber(id);
      setConfirmDelete(null);
    }, "Subscriber deleted.");
  }

  async function exportCsv() {
    setBusy(true);
    setError(null);
    try {
      await downloadSubscribersCsv({ status: tab, search: query.trim() });
    } catch (e) {
      setError((e as Error).message || "Export failed");
    } finally {
      setBusy(false);
    }
  }

  const tabs: { key: Tab; label: string; n: number }[] = [
    { key: "all", label: "All", n: counts.all },
    { key: "subscribed", label: "Subscribed", n: counts.subscribed },
    { key: "pending", label: "Pending", n: counts.pending },
    { key: "unsubscribed", label: "Unsubscribed", n: counts.unsubscribed },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Subscribers</h1>
          <p className="mt-1 text-sm text-slate-500">
            Everyone who signed up for the Brandish newsletter from the site.
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <Download width={16} height={16} /> Export CSV
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      {/* stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Subscribed" value={String(counts.subscribed)} sub="confirmed opt-in" tone="bg-emerald-50 text-emerald-600" />
        <StatCard icon={Clock} label="Pending" value={String(counts.pending)} sub="awaiting confirmation" tone="bg-amber-50 text-amber-600" />
        <StatCard icon={Ban} label="Unsubscribed" value={String(counts.unsubscribed)} sub="opted out" tone="bg-slate-100 text-slate-500" />
        <StatCard icon={Mail} label="Total Sign-ups" value={String(counts.all)} sub="all statuses" tone="bg-brand-soft text-brand" />
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
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search email or source…"
            className="w-64 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20"
          />
        </div>

        {/* list */}
        <div className="divide-y divide-slate-100">
          {loading && rows.length === 0 ? (
            <div className="px-4 py-16 text-center text-slate-400">Loading subscribers…</div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-16 text-center text-slate-400">
              {counts.all === 0
                ? "No subscribers yet — they'll appear here as readers sign up."
                : "No subscribers match this view."}
            </div>
          ) : (
            rows.map((s) => {
              const meta = STATUS_META[s.status];
              const isDeleting = confirmDelete === s._id;
              return (
                <div key={s._id} className={`border-l-2 ${meta.bar}`}>
                  <div className="flex flex-wrap items-center gap-3 px-4 py-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                      <Mail width={16} height={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{s.email}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.badge}`}>
                          {meta.label}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {SOURCE_LABEL[s.source] ?? s.source}
                        {s.categories?.length ? ` · ${s.categories.join(", ")}` : " · All categories"}
                        {" · signed up "}
                        {formatDate(s.createdAt)}
                        {s.confirmedAt ? ` · confirmed ${formatDate(s.confirmedAt)}` : ""}
                      </p>
                    </div>

                    {isDeleting ? (
                      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                        <span className="text-sm text-slate-700">Remove this subscriber?</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                          >
                            Keep
                          </button>
                          <button
                            onClick={() => remove(s._id)}
                            disabled={busy}
                            className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {s.status !== "subscribed" && (
                          <button
                            onClick={() => runOne(() => resendConfirmation(s._id), "Confirmation email sent.")}
                            disabled={busy}
                            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                          >
                            <Send width={14} height={14} /> Re-send confirmation
                          </button>
                        )}
                        {s.status === "subscribed" && (
                          <span className="flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                            <CheckCircle width={14} height={14} /> Confirmed
                          </span>
                        )}
                        <button
                          onClick={() => setConfirmDelete(s._id)}
                          disabled={busy}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                        >
                          <Trash width={14} height={14} /> Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {!loading && total > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border border-slate-200 p-1.5 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft width={16} height={16} />
              </button>
              <span className="px-2">
                Page {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
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
