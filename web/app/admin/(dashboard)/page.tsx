"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ComponentType, SVGProps } from "react";
import { getStoredUser } from "@/lib/auth";
import { getAnalytics, type AnalyticsOverview } from "@/lib/analytics";
import { listPosts, type PostRecord, type PostStatus } from "@/lib/posts";
import { listComments, type CommentRecord } from "@/lib/comments";
import { listUsers, type UserRecord } from "@/lib/users";
import { listCategories, type CategoryRecord } from "@/lib/categories";
import { listMedia, type MediaRecord } from "@/lib/media";
import { AreaChart } from "@/components/admin/charts";
import { formatDate } from "@/components/admin/user-ui";
import {
  Eye,
  FileText,
  MessageSquare,
  Pencil,
  Send,
  Upload,
  UserPlus,
  Users,
} from "@/components/admin/icons";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const SOURCE_COLORS: Record<string, string> = {
  "Organic search": "bg-brand",
  Direct: "bg-emerald-500",
  Social: "bg-amber-500",
  Referral: "bg-rose-500",
};

/* -------------------------------- helpers --------------------------------- */

function compact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toLocaleString("en-US");
}
function duration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)} KB`;
  return `${bytes} B`;
}
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.floor((Date.now() - then) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d} day${d === 1 ? "" : "s"} ago` : formatDate(iso);
}
function withinDays(iso: string, days: number): boolean {
  return Date.now() - new Date(iso).getTime() <= days * 864e5;
}

/* -------------------------------- small parts --------------------------------- */

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white ${className}`}>{children}</div>;
}

function Delta({ text, up }: { text: string; up: boolean }) {
  return <span className={up ? "text-emerald-600" : "text-rose-600"}>{text}</span>;
}

const STATUS_BADGE: Record<PostStatus, { label: string; cls: string }> = {
  published: { label: "Published", cls: "bg-emerald-50 text-emerald-700" },
  draft: { label: "Draft", cls: "bg-slate-100 text-slate-600" },
  scheduled: { label: "Scheduled", cls: "bg-amber-50 text-amber-700" },
  archived: { label: "Archived", cls: "bg-rose-50 text-rose-600" },
};
function StatusBadge({ status }: { status: PostStatus }) {
  const s = STATUS_BADGE[status] ?? STATUS_BADGE.draft;
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  up,
  sub,
}: {
  icon: Icon;
  label: string;
  value: string;
  delta?: string;
  up?: boolean;
  sub?: string;
}) {
  return (
    <Card className="p-5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
        <Icon width={18} height={18} />
      </span>
      <p className="mt-4 text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">
        {value}{" "}
        {delta && (
          <span className="align-middle text-xs font-medium">
            <Delta text={delta} up={up ?? true} />
          </span>
        )}
      </p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </Card>
  );
}

const QUICK_ACTIONS: { label: string; icon: Icon; href: string }[] = [
  { label: "New Article", icon: Pencil, href: "/admin/posts/new" },
  { label: "Upload Media", icon: Upload, href: "/admin/media" },
  { label: "Invite User", icon: UserPlus, href: "/admin/users/new" },
  { label: "New Campaign", icon: Send, href: "/admin/campaign" },
];

/* --------------------------------- the page ----------------------------------- */

export default function DashboardPage() {
  const user = getStoredUser();
  const firstName = user?.name?.split(" ")[0] ?? "there";

  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[] | null>(null);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [media, setMedia] = useState<MediaRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getAnalytics(30).catch(() => null),
      listPosts().catch(() => [] as PostRecord[]),
      listComments().catch(() => [] as CommentRecord[]),
      listUsers().catch(() => null), // super-admin only — editors get null, card shows a dash
      listCategories().catch(() => [] as CategoryRecord[]),
      listMedia().catch(() => [] as MediaRecord[]),
    ]).then(([a, p, c, u, cat, m]) => {
      if (cancelled) return;
      setAnalytics(a);
      setPosts(p);
      setComments(c);
      setUsers(u);
      setCategories(cat);
      setMedia(m);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const categoryName = useMemo(() => {
    const map = new Map(categories.map((c) => [c.slug, c.name]));
    return (slug: string) => map.get(slug) ?? slug.replace(/-/g, " ");
  }, [categories]);

  const publishedCount = useMemo(() => posts.filter((p) => p.status === "published").length, [posts]);
  const publishedThisWeek = useMemo(
    () => posts.filter((p) => p.status === "published" && withinDays(p.createdAt, 7)).length,
    [posts],
  );
  const pendingComments = useMemo(() => comments.filter((c) => c.status === "pending").length, [comments]);
  const activeUsers = useMemo(() => (users ? users.filter((u) => u.active).length : null), [users]);

  const topCategories = useMemo(() => {
    const tally = new Map<string, number>();
    for (const p of posts) tally.set(p.category, (tally.get(p.category) ?? 0) + (p.viewCount || 0));
    const total = [...tally.values()].reduce((s, v) => s + v, 0);
    return [...tally.entries()]
      .map(([slug, views]) => ({ slug, views, pct: total > 0 ? Math.round((views / total) * 100) : 0 }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);
  }, [posts]);

  const recentPosts = useMemo(
    () => [...posts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5),
    [posts],
  );

  const activity = useMemo(() => {
    const postTitle = new Map(posts.map((p) => [p._id, p.title]));
    const items: { icon: Icon; text: React.ReactNode; at: string }[] = [
      ...posts.slice(0, 6).map((p) => ({
        icon: Pencil as Icon,
        at: p.createdAt,
        text: (
          <>
            <b>{p.author?.name ?? "Someone"}</b> {p.status === "published" ? "published" : "drafted"} <b>{p.title}</b>
          </>
        ),
      })),
      ...comments.slice(0, 6).map((c) => ({
        icon: MessageSquare as Icon,
        at: c.createdAt,
        text:
          c.status === "pending" ? (
            <>New comment awaiting review on <b>{postTitle.get(c.postId) ?? "a post"}</b></>
          ) : (
            <><b>{c.authorName}</b> commented on <b>{postTitle.get(c.postId) ?? "a post"}</b></>
          ),
      })),
    ];
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 5);
  }, [posts, comments]);

  const mediaBytes = useMemo(() => media.reduce((s, m) => s + (m.size ?? 0), 0), [media]);
  const MEDIA_CAP = 5e9; // 5 GB soft reference for the usage bar
  const mediaPct = Math.min(100, Math.round((mediaBytes / MEDIA_CAP) * 100));

  const viewsSeries = analytics?.timeseries.map((t) => t.views) ?? [];
  const uniqueSeries = analytics?.timeseries.map((t) => t.unique) ?? [];
  const labels = analytics?.timeseries.map((t) => shortDate(t.date)) ?? [];

  const miniStats = analytics
    ? [
        { label: "Total Views", value: compact(analytics.summary.totalViews.value), delta: `${analytics.summary.totalViews.deltaPct >= 0 ? "+" : ""}${analytics.summary.totalViews.deltaPct}%`, up: analytics.summary.totalViews.deltaPct >= 0 },
        { label: "Unique Visitors", value: compact(analytics.summary.uniqueVisitors.value), delta: `${analytics.summary.uniqueVisitors.deltaPct >= 0 ? "+" : ""}${analytics.summary.uniqueVisitors.deltaPct}%`, up: analytics.summary.uniqueVisitors.deltaPct >= 0 },
        { label: "Avg. Time", value: duration(analytics.summary.avgTimeOnPageSec.value), delta: `${analytics.summary.avgTimeOnPageSec.deltaPct >= 0 ? "+" : ""}${analytics.summary.avgTimeOnPageSec.deltaPct}%`, up: analytics.summary.avgTimeOnPageSec.deltaPct >= 0 },
        { label: "Bounce Rate", value: `${analytics.summary.bounceRatePct.value}%`, delta: `${analytics.summary.bounceRatePct.deltaPct >= 0 ? "+" : ""}${analytics.summary.bounceRatePct.deltaPct}%`, up: analytics.summary.bounceRatePct.deltaPct < 0 },
      ]
    : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Welcome back, {firstName}. Here&rsquo;s what&rsquo;s happening across Brandish today.
        </p>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Eye}
          label="Total Views (30d)"
          value={analytics ? compact(analytics.summary.totalViews.value) : loading ? "…" : "0"}
          delta={analytics ? `${analytics.summary.totalViews.deltaPct >= 0 ? "+" : ""}${analytics.summary.totalViews.deltaPct}%` : undefined}
          up={analytics ? analytics.summary.totalViews.deltaPct >= 0 : true}
        />
        <StatCard
          icon={FileText}
          label="Published Posts"
          value={loading ? "…" : compact(publishedCount)}
          delta={publishedThisWeek > 0 ? `+${publishedThisWeek} this week` : undefined}
          up
          sub={publishedThisWeek === 0 ? "no new posts this week" : undefined}
        />
        <StatCard
          icon={Users}
          label="Active Users"
          value={activeUsers === null ? (loading ? "…" : "—") : compact(activeUsers)}
          sub={activeUsers === null ? (loading ? undefined : "super-admins only") : `of ${users!.length} total`}
        />
        <StatCard
          icon={MessageSquare}
          label="Pending Comments"
          value={loading ? "…" : compact(pendingComments)}
          sub={pendingComments > 0 ? "awaiting moderation" : "queue is clear"}
        />
      </div>

      {/* traffic + categories */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Traffic Overview</h2>
              <p className="text-xs text-slate-500">Page views vs unique visitors</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-brand" />Views</span>
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-500" />Unique</span>
              <span className="rounded-md border border-slate-200 px-2 py-1">Last 30 days</span>
            </div>
          </div>
          <div className="mt-4">
            {analytics ? (
              <AreaChart
                labels={labels}
                series={[
                  { label: "Views", color: "#6366f1", values: viewsSeries },
                  { label: "Unique", color: "#10b981", values: uniqueSeries },
                ]}
              />
            ) : (
              <div className="flex h-72 items-center justify-center text-sm text-slate-400">{loading ? "Loading traffic…" : "No traffic data yet."}</div>
            )}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-4">
            {miniStats.map((m) => (
              <div key={m.label}>
                <p className="text-xs text-slate-500">{m.label}</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">
                  {m.value} <span className="text-xs font-medium"><Delta text={m.delta} up={m.up} /></span>
                </p>
              </div>
            ))}
            {miniStats.length === 0 && <p className="col-span-4 text-xs text-slate-400">{loading ? "Loading…" : "No analytics available."}</p>}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Top Categories</h2>
            <Link href="/admin/categories" className="text-xs font-medium text-brand hover:text-brand-dark">View all</Link>
          </div>
          <div className="mt-4 space-y-3">
            {topCategories.map((c) => (
              <div key={c.slug}>
                <div className="flex justify-between text-xs">
                  <span className="capitalize text-slate-600">{categoryName(c.slug)}</span>
                  <span className="font-medium text-slate-500">{c.pct}%</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                  <div className="h-1.5 rounded-full bg-brand" style={{ width: `${c.pct}%` }} />
                </div>
              </div>
            ))}
            {topCategories.length === 0 && <p className="text-xs text-slate-400">{loading ? "Loading…" : "No category views yet."}</p>}
          </div>

          <h3 className="mt-6 font-semibold text-slate-900">Traffic Sources</h3>
          <div className="mt-3 space-y-2.5">
            {(analytics?.sources ?? []).map((s) => (
              <div key={s.source} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-600">
                  <i className={`h-2 w-2 rounded-full ${SOURCE_COLORS[s.source] ?? "bg-slate-400"}`} />
                  {s.source}
                </span>
                <span className="font-medium text-slate-500">{s.pct}%</span>
              </div>
            ))}
            {(!analytics || analytics.sources.length === 0) && <p className="text-xs text-slate-400">{loading ? "Loading…" : "No source data."}</p>}
          </div>
        </Card>
      </div>

      {/* recent content */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Recent Content</h2>
          <Link href="/admin/posts" className="text-xs font-medium text-brand hover:text-brand-dark">View all content</Link>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
                <th className="pb-2 font-medium">Title</th>
                <th className="pb-2 font-medium">Author</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentPosts.map((row) => (
                <tr key={row._id} className="border-b border-slate-50 last:border-0">
                  <td className="py-3 pr-4 font-medium text-slate-800">
                    <Link href={`/admin/posts/${row._id}/edit`} className="hover:text-brand">{row.title}</Link>
                  </td>
                  <td className="py-3 pr-4 text-slate-500">{row.author?.name ?? "—"}</td>
                  <td className="py-3 pr-4"><StatusBadge status={row.status} /></td>
                  <td className="py-3 pr-4 capitalize text-slate-500">{categoryName(row.category)}</td>
                  <td className="py-3 text-slate-500">{formatDate(row.createdAt)}</td>
                </tr>
              ))}
              {recentPosts.length === 0 && (
                <tr><td colSpan={5} className="py-10 text-center text-slate-400">{loading ? "Loading content…" : "No posts yet."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* activity + quick actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-semibold text-slate-900">Recent Activity</h2>
          <ul className="mt-4 space-y-4">
            {activity.map((a, i) => {
              const Icon = a.icon;
              return (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                    <Icon width={15} height={15} />
                  </span>
                  <div className="text-sm">
                    <p className="text-slate-700">{a.text}</p>
                    <p className="text-xs text-slate-400">{timeAgo(a.at)}</p>
                  </div>
                </li>
              );
            })}
            {activity.length === 0 && <li className="text-sm text-slate-400">{loading ? "Loading activity…" : "No recent activity."}</li>}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-slate-900">Quick Actions</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {QUICK_ACTIONS.map(({ label, icon: Icon, href }) => (
              <Link
                key={label}
                href={href}
                className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 py-4 text-xs font-medium text-slate-600 transition hover:border-brand hover:text-brand"
              >
                <Icon width={18} height={18} />
                {label}
              </Link>
            ))}
          </div>
          <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50 p-4">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-slate-600">Media Storage</span>
              <span className="text-slate-500">{media.length} files · {formatBytes(mediaBytes)}</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-slate-200">
              <div className="h-1.5 rounded-full bg-brand" style={{ width: `${mediaPct}%` }} />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">{formatBytes(mediaBytes)} of 5 GB reference</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
