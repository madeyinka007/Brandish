"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getAnalytics, type AnalyticsOverview, type Metric, type ApiError } from "@/lib/analytics";
import { AreaChart, Donut, Sparkline } from "@/components/admin/charts";
import { Activity, ArrowRight, Clock, Download, Eye, Users } from "@/components/admin/icons";

const RANGES = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
];

// Fixed palette so a source/device keeps its colour across the donut, legend and bars.
const SOURCE_COLORS: Record<string, string> = {
  "Organic search": "#6366f1",
  Direct: "#10b981",
  Social: "#f59e0b",
  Referral: "#f43f5e",
};
const DEVICE_COLORS: Record<string, string> = { Desktop: "#6366f1", Mobile: "#10b981", Tablet: "#f59e0b" };

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}
function duration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
function flag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "🌐";
  return String.fromCodePoint(...[...code].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function rangeLabel(o: AnalyticsOverview): string {
  const start = new Date(o.range.start);
  const end = new Date(o.range.end);
  const s = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const e = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${s} – ${e} · compared with the previous ${o.rangeDays} days`;
}

function Delta({ metric, goodWhenUp = true }: { metric: Metric; goodWhenUp?: boolean }) {
  const up = metric.deltaPct >= 0;
  const good = goodWhenUp ? up : !up;
  const tone = metric.deltaPct === 0 ? "text-slate-400" : good ? "text-emerald-600" : "text-rose-500";
  const sign = up ? "+" : "";
  return (
    <span className={`text-xs font-medium ${tone}`}>
      {sign}
      {metric.deltaPct}% <span className="text-slate-400">vs prev.</span>
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  metric,
  spark,
  color,
  goodWhenUp = true,
}: {
  icon: (p: { width?: number; height?: number }) => React.ReactNode;
  label: string;
  value: string;
  metric: Metric;
  spark: number[];
  color: string;
  goodWhenUp?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-sm text-slate-500">
            <Icon width={15} height={15} /> {label}
          </p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900">{value}</p>
          <div className="mt-1">
            <Delta metric={metric} goodWhenUp={goodWhenUp} />
          </div>
        </div>
        <div className="w-24 shrink-0">
          <Sparkline values={spark.length ? spark : [0, 0]} stroke={color} />
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAnalytics(days)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError((e as ApiError).message || "Failed to load analytics"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [days]);

  const viewsSeries = useMemo(() => data?.timeseries.map((t) => t.views) ?? [], [data]);
  const uniqueSeries = useMemo(() => data?.timeseries.map((t) => t.unique) ?? [], [data]);
  const labels = useMemo(() => data?.timeseries.map((t) => shortDate(t.date)) ?? [], [data]);

  function exportCsv() {
    if (!data) return;
    const rows = [
      ["Date", "Views", "Unique visitors"],
      ...data.timeseries.map((t) => [t.date, String(t.views), String(t.unique)]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `brandish-analytics-${data.rangeDays}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalSessions = data ? data.sources.reduce((s, x) => s + x.sessions, 0) : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">
            {data ? rangeLabel(data) : "Traffic, engagement and top content across the site."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600"
          >
            {RANGES.map((r) => (
              <option key={r.days} value={r.days}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            onClick={exportCsv}
            disabled={!data}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
          >
            <Download width={16} height={16} /> Export report
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-24 text-center text-slate-400">
          Loading analytics…
        </div>
      ) : data ? (
        <>
          {/* stat cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Eye} label="Total Views" value={fmt(data.summary.totalViews.value)} metric={data.summary.totalViews} spark={viewsSeries} color="#6366f1" />
            <StatCard icon={Users} label="Unique Visitors" value={fmt(data.summary.uniqueVisitors.value)} metric={data.summary.uniqueVisitors} spark={uniqueSeries} color="#10b981" />
            <StatCard icon={Clock} label="Avg. Time on Page" value={duration(data.summary.avgTimeOnPageSec.value)} metric={data.summary.avgTimeOnPageSec} spark={viewsSeries} color="#f59e0b" />
            <StatCard icon={Activity} label="Bounce Rate" value={`${data.summary.bounceRatePct.value}%`} metric={data.summary.bounceRatePct} spark={uniqueSeries} color="#f43f5e" goodWhenUp={false} />
          </div>

          {/* traffic over time + sources */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-slate-900">Traffic over time</h2>
                  <p className="text-sm text-slate-500">Views vs unique visitors, daily</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#6366f1" }} /> Views</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#10b981" }} /> Unique</span>
                </div>
              </div>
              <div className="mt-4">
                <AreaChart
                  labels={labels}
                  series={[
                    { label: "Views", color: "#6366f1", values: viewsSeries },
                    { label: "Unique", color: "#10b981", values: uniqueSeries },
                  ]}
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold text-slate-900">Traffic sources</h2>
              <p className="text-sm text-slate-500">Share of total sessions</p>
              <div className="my-5">
                <Donut
                  centerLabel={fmt(totalSessions)}
                  centerSub="sessions"
                  segments={data.sources.map((s) => ({ label: s.source, color: SOURCE_COLORS[s.source] ?? "#94a3b8", value: s.sessions }))}
                />
              </div>
              <ul className="space-y-2.5">
                {data.sources.map((s) => (
                  <li key={s.source} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: SOURCE_COLORS[s.source] ?? "#94a3b8" }} />
                    <span className="flex-1 text-slate-600">{s.source}</span>
                    <span className="tabular-nums text-slate-400">{fmt(s.sessions)}</span>
                    <span className="w-10 text-right font-medium text-slate-700">{s.pct}%</span>
                  </li>
                ))}
                {data.sources.length === 0 && <li className="text-sm text-slate-400">No sessions in this period.</li>}
              </ul>
            </div>
          </div>

          {/* top posts + devices/countries */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white lg:col-span-2">
              <div className="flex items-center justify-between border-b border-slate-100 p-5">
                <div>
                  <h2 className="font-semibold text-slate-900">Top performing posts</h2>
                  <p className="text-sm text-slate-500">Ranked by views in the selected period</p>
                </div>
                <Link href="/admin/posts" className="flex items-center gap-1 text-sm font-medium text-brand hover:underline">
                  View all <ArrowRight width={14} height={14} />
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
                      <th className="py-2.5 pl-5 font-medium">Post</th>
                      <th className="py-2.5 font-medium">Views</th>
                      <th className="py-2.5 font-medium">Avg. time</th>
                      <th className="py-2.5 font-medium">Bounce</th>
                      <th className="py-2.5 pr-5 text-right font-medium">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topPosts.map((p, i) => (
                      <tr key={p.postId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                        <td className="py-3 pl-5">
                          <div className="flex items-center gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-soft text-xs font-semibold text-brand">{i + 1}</span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-800">{p.title}</p>
                              {p.category && <p className="text-xs capitalize text-slate-400">{p.category.replace(/-/g, " ")}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 font-medium text-slate-700">{fmt(p.views)}</td>
                        <td className="py-3 text-slate-500">{duration(p.avgTimeSec)}</td>
                        <td className="py-3 text-slate-500">{p.bounceRatePct}%</td>
                        <td className="py-3 pr-5 text-right">
                          <span className={`font-medium ${p.changePct >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                            {p.changePct >= 0 ? "▲" : "▼"} {Math.abs(p.changePct)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                    {data.topPosts.length === 0 && (
                      <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400">No views recorded in this period.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-6">
              {/* devices */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="font-semibold text-slate-900">Devices</h2>
                <p className="text-sm text-slate-500">Sessions by device type</p>
                <ul className="mt-4 space-y-4">
                  {data.devices.map((d) => (
                    <li key={d.device}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">{d.device}</span>
                        <span className="text-slate-400">{fmt(d.sessions)} · <span className="font-medium text-slate-700">{d.pct}%</span></span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full" style={{ width: `${d.pct}%`, background: DEVICE_COLORS[d.device] ?? "#94a3b8" }} />
                      </div>
                    </li>
                  ))}
                  {data.devices.length === 0 && <li className="text-sm text-slate-400">No device data.</li>}
                </ul>
              </div>

              {/* countries */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="font-semibold text-slate-900">Top countries</h2>
                <p className="text-sm text-slate-500">Sessions by visitor location</p>
                <ul className="mt-4 space-y-3">
                  {data.topCountries.map((c) => (
                    <li key={c.code} className="flex items-center gap-3 text-sm">
                      <span className="text-lg leading-none">{flag(c.code)}</span>
                      <span className="flex-1 text-slate-600">{c.country}</span>
                      <span className="tabular-nums text-slate-400">{fmt(c.sessions)}</span>
                      <span className="w-12 text-right font-medium text-slate-700">{c.pct}%</span>
                    </li>
                  ))}
                  {data.topCountries.length === 0 && <li className="text-sm text-slate-400">No location data.</li>}
                </ul>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
