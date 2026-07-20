"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getUser,
  updateUser,
  assignRole,
  setUserStatus,
  type UserRecord,
  type ApiError,
} from "@/lib/users";
import { Avatar, ROLE_META, ROLE_ORDER, statusOf, formatDate, type Role } from "@/components/admin/user-ui";
import { ArrowLeft, Check, Mail, Save } from "@/components/admin/icons";

function messageFor(err: ApiError): string {
  if (err.code === "EMAIL_EXISTS") return "A user with that email already exists.";
  if (err.code === "USER_NOT_FOUND") return "This user no longer exists.";
  if (err.status === 400) return err.message || "Please check the form and try again.";
  if (err.status === 500) return "The server couldn't save the changes. Please try again.";
  return err.message || "Unable to save changes.";
}

function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

export default function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [original, setOriginal] = useState<UserRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("author");
  const [status, setStatus] = useState<"active" | "suspended">("active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const u = await getUser(id);
        if (!active) return;
        if (!u) {
          setLoadError("User not found.");
          return;
        }
        const { first, last } = splitName(u.name);
        setOriginal(u);
        setFirstName(first);
        setLastName(last);
        setEmail(u.email);
        setRole(u.role);
        setStatus(u.active ? "active" : "suspended");
      } catch (e) {
        if (active) setLoadError((e as Error).message || "Failed to load user");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const fullName = `${firstName} ${lastName}`.trim();
  const previewName = fullName || original?.name || "User";

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const desiredActive = status === "active";

  const changes = useMemo(() => {
    if (!original) return { name: false, email: false, role: false, status: false, any: false };
    const name = fullName !== original.name;
    const em = email.trim() !== original.email;
    const rl = role !== original.role;
    const st = desiredActive !== original.active;
    return { name, email: em, role: rl, status: st, any: name || em || rl || st };
  }, [original, fullName, email, role, desiredActive]);

  const canSave = !!original && firstName.trim() !== "" && lastName.trim() !== "" && emailValid && changes.any;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!original || !canSave) return;
    setSaving(true);
    try {
      // Profile (name/email) share one endpoint; role and status have their own.
      if (changes.name || changes.email) {
        await updateUser(original._id, { name: fullName, email: email.trim() });
      }
      if (changes.role) await assignRole(original._id, role);
      if (changes.status) await setUserStatus(original._id, desiredActive);
      router.push("/admin/users");
    } catch (err) {
      setError(messageFor(err as ApiError));
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-sm text-slate-400">Loading user…</div>;
  }
  if (loadError) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">{loadError}</p>
        <Link href="/admin/users" className="mt-4 inline-block text-sm font-medium text-brand hover:text-brand-dark">
          ← Back to users
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-6xl">
      {/* breadcrumb + header */}
      <nav className="mb-3 flex items-center gap-1.5 text-sm text-slate-400">
        <Link href="/admin/users" className="hover:text-slate-600">
          Users
        </Link>
        <span>›</span>
        <span className="text-slate-600">Edit User</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            href="/admin/users"
            className="mt-1 rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50"
            aria-label="Back to users"
          >
            <ArrowLeft width={18} height={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Edit User</h1>
            <p className="mt-1 text-sm text-slate-500">Update this member&rsquo;s profile, role and access.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/users"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving || !canSave}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save width={16} height={16} />
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* main column */}
        <div className="space-y-6 lg:col-span-2">
          {/* profile */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Profile details</h2>
            <p className="text-sm text-slate-500">Basic information shown across the workspace.</p>

            <div className="mt-4 flex items-center gap-4">
              <Avatar name={previewName} size={56} />
              <div className="text-sm">
                <p className="font-medium text-slate-700">Profile photo</p>
                <p className="text-xs text-slate-400">Falls back to initials. Upload isn&rsquo;t wired up yet.</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="First name" required>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Last name" required>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Email address" required>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`${inputCls} pl-10`}
                    />
                  </div>
                </Field>
              </div>
            </div>
          </section>

          {/* role & access */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Role &amp; access</h2>
            <p className="text-sm text-slate-500">Change the role or suspend the account.</p>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ROLE_ORDER.map((r) => {
                const active = role === r;
                return (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setRole(r)}
                    className={`rounded-lg border p-3 text-left transition ${
                      active ? "border-brand bg-brand-soft/60 ring-1 ring-brand" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                          active ? "border-brand bg-brand text-white" : "border-slate-300"
                        }`}
                      >
                        {active && <Check width={11} height={11} strokeWidth={3} />}
                      </span>
                      <span className="text-sm font-medium text-slate-800">{ROLE_META[r].label}</span>
                    </div>
                    <p className="mt-1.5 pl-6 text-xs text-slate-500">{ROLE_META[r].blurb}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 max-w-xs">
              <Field label="Account status">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "active" | "suspended")}
                  className={inputCls}
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </Field>
            </div>
          </section>
        </div>

        {/* preview / account column */}
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Preview</h2>
            <div className="mt-4 flex items-center gap-3">
              <Avatar name={previewName} size={44} />
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800">{previewName}</p>
                <p className="truncate text-xs text-slate-400">{email || "email@brandish.co"}</p>
              </div>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <Row k="Role" v={ROLE_META[role].label} />
              <Row
                k="Status"
                v={status === "suspended" ? "Suspended" : original && !original.emailVerified ? "Pending" : "Active"}
                vClass={status === "suspended" ? "text-rose-600" : original && !original.emailVerified ? "text-amber-600" : "text-emerald-600"}
              />
              {original && <Row k="Joined" v={formatDate(original.createdAt)} />}
              {original && <Row k="Email verified" v={original.emailVerified ? "Yes" : "No"} />}
            </dl>
            {original && !changes.any && (
              <p className="mt-4 text-xs text-slate-400">No changes yet.</p>
            )}
          </section>
        </div>
      </div>
    </form>
  );
}

/* ------------------------------ small pieces ------------------------------ */

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/30";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function Row({ k, v, vClass = "text-slate-800" }: { k: string; v: string; vClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{k}</dt>
      <dd className={`font-medium ${vClass}`}>{v}</dd>
    </div>
  );
}
