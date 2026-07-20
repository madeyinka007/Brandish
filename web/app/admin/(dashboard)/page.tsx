"use client";

import type { ComponentType, SVGProps } from "react";
import { getStoredUser } from "@/lib/auth";
import {
  Eye,
  FileText,
  MessageSquare,
  Pencil,
  Send,
  Tag,
  Upload,
  UserPlus,
  Users,
} from "@/components/admin/icons";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/* ----------------------------- static design data ----------------------------- */

const STATS = [
  { label: "Total Views", value: "248.5K", delta: "+12.4%", up: true, icon: Eye },
  { label: "Published Posts", value: "1,284", delta: "+38 this week", up: true, icon: FileText },
  { label: "Active Users", value: "8,942", delta: "+5.1%", up: true, icon: Users },
  { label: "Pending Comments", value: "127", delta: "-8.3%", up: false, icon: MessageSquare },
];

const TRAFFIC_MINI = [
  { label: "Total Views", value: "44,700", delta: "+12.4%", up: true },
  { label: "Unique Visitors", value: "37,250", delta: "+8.9%", up: true },
  { label: "Avg. Session", value: "3m 42s", delta: "+0.6%", up: true },
  { label: "Bounce Rate", value: "38.2%", delta: "-2.1%", up: false },
];

const CATEGORIES = [
  { name: "Brand Strategy", pct: 32 },
  { name: "Marketing", pct: 26 },
  { name: "Design", pct: 18 },
  { name: "Technology", pct: 14 },
  { name: "Culture", pct: 10 },
];

const SOURCES = [
  { name: "Organic Search", pct: 46, color: "bg-brand" },
  { name: "Direct", pct: 28, color: "bg-emerald-500" },
  { name: "Social", pct: 18, color: "bg-amber-500" },
  { name: "Referral", pct: 8, color: "bg-rose-500" },
];

type Status = "Published" | "Draft" | "In Review";
const CONTENT: { title: string; author: string; status: Status; category: string; date: string }[] = [
  { title: "How to Build a Memorable Brand Voice in 2026", author: "Tunde Bakare", status: "Published", category: "Brand Strategy", date: "Jul 18, 2026" },
  { title: "Q3 Campaign Playbook: Social-First Launches", author: "Ngozi Eze", status: "Draft", category: "Marketing", date: "Jul 17, 2026" },
  { title: "Design Systems for Small Teams", author: "Sarah Chen", status: "In Review", category: "Design", date: "Jul 16, 2026" },
  { title: "The State of AI in Content Workflows", author: "Tunde Bakare", status: "Published", category: "Technology", date: "Jul 15, 2026" },
  { title: "Behind Brandish: Our Remote Culture", author: "Adaeze Okafor", status: "Published", category: "Culture", date: "Jul 14, 2026" },
];

const ACTIVITY: { icon: Icon; text: React.ReactNode; time: string }[] = [
  { icon: Pencil, text: <><b>Tunde Bakare</b> published <b>How to Build a Memorable Brand Voice</b></>, time: "2 min ago" },
  { icon: MessageSquare, text: <>New comment awaiting review on <b>Design Systems for Small Teams</b></>, time: "18 min ago" },
  { icon: Upload, text: <><b>Sarah Chen</b> uploaded 6 files to <b>Media › Campaign Assets</b></>, time: "1 hr ago" },
  { icon: Users, text: <>New user registered <b>kemi.adeyemi@brandish.co</b></>, time: "3 hrs ago" },
  { icon: Tag, text: <><b>Ngozi Eze</b> created category <b>Growth Marketing</b></>, time: "5 hrs ago" },
];

const QUICK_ACTIONS: { label: string; icon: Icon }[] = [
  { label: "New Article", icon: Pencil },
  { label: "Upload Media", icon: Upload },
  { label: "Invite User", icon: UserPlus },
  { label: "New Campaign", icon: Send },
];

/* -------------------------------- small parts --------------------------------- */

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white ${className}`}>{children}</div>;
}

function Delta({ text, up }: { text: string; up: boolean }) {
  return <span className={up ? "text-emerald-600" : "text-rose-600"}>{text}</span>;
}

function StatusBadge({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    Published: "bg-emerald-50 text-emerald-700",
    Draft: "bg-slate-100 text-slate-600",
    "In Review": "bg-amber-50 text-amber-700",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>{status}</span>;
}

/** Simple two-series area chart (Views vs Unique) rendered as inline SVG. */
function TrafficChart() {
  const views = "M0,150 C60,140 100,120 160,118 C230,116 270,95 340,100 C410,105 450,70 520,60 C590,50 640,40 700,30";
  const unique = "M0,175 C60,170 100,158 160,155 C230,152 270,140 340,138 C410,136 450,120 520,112 C590,104 640,96 700,88";
  return (
    <svg viewBox="0 0 700 210" className="h-52 w-full" preserveAspectRatio="none">
      {[0, 52, 105, 157, 200].map((y) => (
        <line key={y} x1="0" y1={y} x2="700" y2={y} stroke="#f1f5f9" strokeWidth="1" />
      ))}
      <path d={`${views} L700,210 L0,210 Z`} fill="url(#gv)" opacity="0.9" />
      <path d={`${unique} L700,210 L0,210 Z`} fill="url(#gu)" opacity="0.7" />
      <path d={views} fill="none" stroke="#4f46e5" strokeWidth="2.5" />
      <path d={unique} fill="none" stroke="#10b981" strokeWidth="2.5" />
      <defs>
        <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="gu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* --------------------------------- the page ----------------------------------- */

export default function DashboardPage() {
  const user = getStoredUser();
  const firstName = user?.name?.split(" ")[0] ?? "there";

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
        {STATS.map(({ label, value, delta, up, icon: Icon }) => (
          <Card key={label} className="p-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <Icon width={18} height={18} />
            </span>
            <p className="mt-4 text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {value} <span className="align-middle text-xs font-medium"><Delta text={delta} up={up} /></span>
            </p>
          </Card>
        ))}
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
              <span className="rounded-md border border-slate-200 px-2 py-1">Last 7 days</span>
            </div>
          </div>
          <div className="mt-4"><TrafficChart /></div>
          <div className="mt-2 flex justify-between px-1 text-[11px] text-slate-400">
            {["Jun 25", "Jun 26", "Jun 27", "Jun 28", "Jun 29", "Jun 30", "Jul 1"].map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-4">
            {TRAFFIC_MINI.map((m) => (
              <div key={m.label}>
                <p className="text-xs text-slate-500">{m.label}</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">
                  {m.value} <span className="text-xs font-medium"><Delta text={m.delta} up={m.up} /></span>
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Top Categories</h2>
            <a href="#" className="text-xs font-medium text-brand hover:text-brand-dark">View all</a>
          </div>
          <div className="mt-4 space-y-3">
            {CATEGORIES.map((c) => (
              <div key={c.name}>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">{c.name}</span>
                  <span className="font-medium text-slate-500">{c.pct}%</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                  <div className="h-1.5 rounded-full bg-brand" style={{ width: `${c.pct * 2.5}%` }} />
                </div>
              </div>
            ))}
          </div>
          <h3 className="mt-6 font-semibold text-slate-900">Traffic Sources</h3>
          <div className="mt-3 space-y-2.5">
            {SOURCES.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-600">
                  <i className={`h-2 w-2 rounded-full ${s.color}`} />
                  {s.name}
                </span>
                <span className="font-medium text-slate-500">{s.pct}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* recent content */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Recent Content</h2>
          <a href="#" className="text-xs font-medium text-brand hover:text-brand-dark">View all content</a>
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
              {CONTENT.map((row) => (
                <tr key={row.title} className="border-b border-slate-50 last:border-0">
                  <td className="py-3 pr-4 font-medium text-slate-800">{row.title}</td>
                  <td className="py-3 pr-4 text-slate-500">{row.author}</td>
                  <td className="py-3 pr-4"><StatusBadge status={row.status} /></td>
                  <td className="py-3 pr-4 text-slate-500">{row.category}</td>
                  <td className="py-3 text-slate-500">{row.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* activity + quick actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-semibold text-slate-900">Recent Activity</h2>
          <ul className="mt-4 space-y-4">
            {ACTIVITY.map((a, i) => {
              const Icon = a.icon;
              return (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                    <Icon width={15} height={15} />
                  </span>
                  <div className="text-sm">
                    <p className="text-slate-700">{a.text}</p>
                    <p className="text-xs text-slate-400">{a.time}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-slate-900">Quick Actions</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {QUICK_ACTIONS.map(({ label, icon: Icon }) => (
              <button
                key={label}
                className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 py-4 text-xs font-medium text-slate-600 transition hover:border-brand hover:text-brand"
              >
                <Icon width={18} height={18} />
                {label}
              </button>
            ))}
          </div>
          <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50 p-4">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-slate-600">Media Storage</span>
              <span className="text-slate-500">68%</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-slate-200">
              <div className="h-1.5 rounded-full bg-brand" style={{ width: "68%" }} />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
