"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  listUsers,
  setUserStatus,
  deleteUser,
  type UserRecord,
} from "@/lib/users";
import {
  Avatar,
  RoleBadge,
  StatusBadge,
  statusOf,
  formatDate,
  ROLE_META,
  ROLE_ORDER,
  type Role,
  type Status,
} from "@/components/admin/user-ui";
import {
  Activity,
  Ban,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Mail,
  MoreVertical,
  Pencil,
  Plus,
  Trash,
  Users as UsersIcon,
} from "@/components/admin/icons";

const PAGE_SIZE = 8;

type TabKey = "all" | Role;
const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "super-admin", label: "Admins" },
  { key: "editor", label: "Editors" },
  { key: "author", label: "Authors" },
  { key: "reader", label: "Readers" },
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
  value: number;
  sub: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
        <Icon width={18} height={18} />
      </span>
      <p className="mt-4 text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value.toLocaleString()}</p>
      <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setUsers(await listUsers());
    } catch (e) {
      setError((e as Error).message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // ---- derived stats (real, from the fetched set) ----
  const counts = useMemo(() => {
    const byRole: Record<string, number> = {};
    let active = 0;
    let pending = 0;
    let suspended = 0;
    for (const u of users) {
      byRole[u.role] = (byRole[u.role] ?? 0) + 1;
      const s = statusOf(u);
      if (s === "Active") active++;
      else if (s === "Pending") pending++;
      else suspended++;
    }
    return { total: users.length, active, pending, suspended, byRole };
  }, [users]);

  // ---- filtering ----
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (tab !== "all" && u.role !== tab) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (ROLE_META[u.role]?.label ?? u.role).toLowerCase().includes(q)
      );
    });
  }, [users, tab, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE);

  // reset page + selection when filters change
  useEffect(() => {
    setPage(1);
  }, [tab, query]);

  const pageIds = pageRows.map((u) => u._id);
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

  // ---- actions (real API calls) ----
  async function doSetStatus(ids: string[], active: boolean) {
    setBusy(true);
    setMenuFor(null);
    try {
      await Promise.all(ids.map((id) => setUserStatus(id, active)));
      await load();
      setSelected(new Set());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function doDelete(ids: string[]) {
    const label = ids.length === 1 ? "this user" : `${ids.length} users`;
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    setBusy(true);
    setMenuFor(null);
    try {
      await Promise.all(ids.map((id) => deleteUser(id)));
      await load();
      setSelected(new Set());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const rows = [
      ["Name", "Email", "Role", "Status", "Joined"],
      ...filtered.map((u) => [u.name, u.email, ROLE_META[u.role]?.label ?? u.role, statusOf(u), formatDate(u.createdAt)]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "brandish-users.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6" onClick={() => setMenuFor(null)}>
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage team members, roles and access across the Brandish workspace.
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
            disabled
            title="Filtering is available via the tabs and search below"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-400"
          >
            <Filter width={16} height={16} /> Filters
          </button>
          <Link
            href="/admin/users/new"
            className="flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
          >
            <Plus width={16} height={16} /> Add User
          </Link>
        </div>
      </div>

      {/* stat cards (real counts) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={UsersIcon} label="Total Users" value={counts.total} sub="in workspace" tone="bg-brand-soft text-brand" />
        <StatCard icon={Activity} label="Active" value={counts.active} sub="verified & enabled" tone="bg-emerald-50 text-emerald-600" />
        <StatCard icon={Mail} label="Pending Invites" value={counts.pending} sub="awaiting verification" tone="bg-amber-50 text-amber-600" />
        <StatCard icon={Ban} label="Suspended" value={counts.suspended} sub="disabled accounts" tone="bg-rose-50 text-rose-600" />
      </div>

      {/* table card */}
      <div className="rounded-xl border border-slate-200 bg-white">
        {/* tabs + search */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => {
              const n = t.key === "all" ? counts.total : counts.byRole[t.key] ?? 0;
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
            placeholder="Search users…"
            className="w-56 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20"
          />
        </div>

        {/* bulk bar */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-brand-soft/50 px-4 py-2.5">
            <span className="text-sm font-medium text-slate-700">{selected.size} selected</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => doSetStatus([...selected], true)}
                disabled={busy}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Activate
              </button>
              <button
                onClick={() => doSetStatus([...selected], false)}
                disabled={busy}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Suspend
              </button>
              <button
                onClick={() => doDelete([...selected])}
                disabled={busy}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        )}

        {/* table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
                <th className="w-10 px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleAll}
                    aria-label="Select all on page"
                    className="h-4 w-4 rounded border-slate-300 accent-[color:var(--color-brand)]"
                  />
                </th>
                <th className="py-2.5 font-medium">User</th>
                <th className="py-2.5 font-medium">Role</th>
                <th className="py-2.5 font-medium">Status</th>
                <th className="py-2.5 font-medium">Joined</th>
                <th className="w-10 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    Loading users…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-rose-600">
                    {error}{" "}
                    <button onClick={() => void load()} className="ml-2 font-medium underline">
                      Retry
                    </button>
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    No users match your filters.
                  </td>
                </tr>
              ) : (
                pageRows.map((u) => {
                  const status: Status = statusOf(u);
                  return (
                    <tr key={u._id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(u._id)}
                          onChange={() => toggleOne(u._id)}
                          aria-label={`Select ${u.name}`}
                          className="h-4 w-4 rounded border-slate-300 accent-[color:var(--color-brand)]"
                        />
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} src={u.avatar} />
                          <div className="min-w-0">
                            <div className="truncate font-medium text-slate-800">{u.name}</div>
                            <div className="truncate text-xs text-slate-400">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="py-3">
                        <StatusBadge status={status} />
                      </td>
                      <td className="py-3 text-slate-500">{formatDate(u.createdAt)}</td>
                      <td className="relative py-3 pr-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuFor(menuFor === u._id ? null : u._id);
                          }}
                          aria-label="Row actions"
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          <MoreVertical width={16} height={16} />
                        </button>
                        {menuFor === u._id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-4 top-11 z-10 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg"
                          >
                            <Link
                              href={`/admin/users/${u._id}/edit`}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              <Pencil width={15} height={15} /> Edit
                            </Link>
                            {status === "Suspended" ? (
                              <button
                                onClick={() => doSetStatus([u._id], true)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                              >
                                <CheckCircle width={15} height={15} /> Activate
                              </button>
                            ) : (
                              <button
                                onClick={() => doSetStatus([u._id], false)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                              >
                                <Ban width={15} height={15} /> Suspend
                              </button>
                            )}
                            <button
                              onClick={() => doDelete([u._id])}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                            >
                              <Trash width={15} height={15} /> Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* pagination */}
        {!loading && !error && filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>
              Showing {(pageClamped - 1) * PAGE_SIZE + 1}–
              {Math.min(pageClamped * PAGE_SIZE, filtered.length)} of {filtered.length} users
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

      {/* roles & permissions legend (real counts) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Roles &amp; Permissions</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {ROLE_ORDER.map((role) => (
            <div key={role} className="rounded-lg border border-slate-100 p-4">
              <div className="flex items-center justify-between">
                <RoleBadge role={role} />
                <span className="text-xs text-slate-400">{counts.byRole[role] ?? 0} users</span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">{ROLE_META[role].blurb}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
