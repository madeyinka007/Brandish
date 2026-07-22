"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUser, setUserStatus, type ApiError } from "@/lib/users";
import { Avatar, ROLE_META, ROLE_ORDER, type Role } from "@/components/admin/user-ui";
import MediaPickerModal from "@/components/admin/MediaPickerModal";
import { ArrowLeft, Check, Mail, Phone, Send } from "@/components/admin/icons";

type Invite = "email" | "password";

/** Any 8+ char string satisfies the API; used for the email-invite flow where the admin sets no password. */
function randomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let s = "";
  for (const b of bytes) s += (b % 36).toString(36);
  return `Br-${s}9A`; // guarantees length ≥ 8 with letters + digits
}

function messageFor(err: ApiError): string {
  if (err.code === "EMAIL_EXISTS") return "A user with that email already exists.";
  if (err.status === 400) return err.message || "Please check the form and try again.";
  if (err.status === 500) return "The server couldn't create the user. Please try again.";
  return err.message || "Unable to create user.";
}

export default function AddUserPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [status, setStatus] = useState<"active" | "suspended">("active");
  const [invite, setInvite] = useState<Invite>("email");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullName = `${firstName} ${lastName}`.trim();
  const previewName = fullName || "New user";

  const canSubmit = useMemo(
    () =>
      firstName.trim() &&
      lastName.trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
      (invite === "email" || password.length >= 8),
    [firstName, lastName, email, invite, password],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canSubmit) {
      setError(
        invite === "password" && password.length < 8
          ? "Set a temporary password of at least 8 characters (or switch to email invite)."
          : "Fill in first name, last name and a valid email.",
      );
      return;
    }
    setSaving(true);
    try {
      const created = await createUser({
        name: fullName,
        email: email.trim(),
        role,
        password: invite === "password" ? password : randomPassword(),
        avatar: avatar || undefined,
      });
      // Account status has its own endpoint; only call it when the admin picked "suspended".
      if (status === "suspended") await setUserStatus(created._id, false);
      router.push("/admin/users");
    } catch (err) {
      setError(messageFor(err as ApiError));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-6xl">
      {/* breadcrumb + header */}
      <nav className="mb-3 flex items-center gap-1.5 text-sm text-slate-400">
        <Link href="/admin/users" className="hover:text-slate-600">
          Users
        </Link>
        <span>›</span>
        <span className="text-slate-600">Add User</span>
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
            <h1 className="text-2xl font-bold text-slate-900">Add User</h1>
            <p className="mt-1 text-sm text-slate-500">
              Create an account and assign a role. The user receives an email invite to verify
              their account.
            </p>
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
            disabled={saving || !canSubmit}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send width={16} height={16} />
            {saving ? "Creating…" : "Create & send invite"}
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
          {/* profile details */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Profile details</h2>
            <p className="text-sm text-slate-500">Basic information shown across the workspace.</p>

            <div className="mt-4 flex items-center gap-4">
              <Avatar name={previewName} src={avatar} size={56} />
              <div className="text-sm">
                <p className="font-medium text-slate-700">Profile photo</p>
                <p className="text-xs text-slate-400">Pick an image from the media library, or leave it for initials.</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Choose from library
                  </button>
                  {avatar && (
                    <button
                      type="button"
                      onClick={() => setAvatar("")}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="First name" required>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Kemi"
                  className={inputCls}
                />
              </Field>
              <Field label="Last name" required>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Adeyemi"
                  className={inputCls}
                />
              </Field>
              <Field label="Email address" required>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="kemi.adeyemi@brandish.co"
                    className={`${inputCls} pl-10`}
                  />
                </div>
              </Field>
              <Field label="Phone number" hint="Optional">
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+234 801 234 5678"
                    className={`${inputCls} pl-10`}
                  />
                </div>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Job title" hint="Optional">
                  <input
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Content Strategist"
                    className={inputCls}
                  />
                </Field>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Phone and job title are captured here for later — the account stores name, email and role.
            </p>
          </section>

          {/* role & access */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Role &amp; access</h2>
            <p className="text-sm text-slate-500">Choose a role. The API enforces permissions per role.</p>

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

          {/* invite & security */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Invite &amp; security</h2>
            <p className="text-sm text-slate-500">How this user gets access for the first time.</p>

            <div className="mt-4 space-y-3">
              <InviteOption
                selected={invite === "email"}
                onSelect={() => setInvite("email")}
                title="Send email invite"
                desc="A verification email is sent; the user activates their account via the link."
              />
              <InviteOption
                selected={invite === "password"}
                onSelect={() => setInvite("password")}
                title="Set a temporary password"
                desc="You set an initial password (min 8 chars) and share it. The user still verifies their email."
              />
              {invite === "password" && (
                <div className="pl-8">
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Temporary password (min 8 characters)"
                    className={inputCls}
                  />
                </div>
              )}
            </div>
          </section>
        </div>

        {/* preview column */}
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Preview</h2>
            <div className="mt-4 flex items-center gap-3">
              <Avatar name={previewName} src={avatar} size={44} />
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800">{previewName}</p>
                <p className="truncate text-xs text-slate-400">{email || "email@brandish.co"}</p>
              </div>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <Row k="Role" v={ROLE_META[role].label} />
              <Row k="Status" v={status === "active" ? "Pending invite" : "Suspended"} vClass="text-amber-600" />
              <Row k="Access" v={invite === "email" ? "Email invite" : "Temp password"} />
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 bg-brand-soft/40 p-5">
            <h2 className="font-semibold text-slate-900">What happens next</h2>
            <ul className="mt-3 space-y-2.5 text-sm text-slate-600">
              {[
                `A verification email is sent to ${email || "the new user"}.`,
                "The account starts as Pending until the email is verified.",
                "Once verified, the user can sign in and it moves to Active.",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <Check width={15} height={15} className="mt-0.5 shrink-0 text-brand" strokeWidth={3} />
                  {t}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <MediaPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={(url) => setAvatar(url)} />
    </form>
  );
}

/* ------------------------------ small pieces ------------------------------ */

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/30";

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function InviteOption({
  selected,
  onSelect,
  title,
  desc,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${
        selected ? "border-brand bg-brand-soft/60 ring-1 ring-brand" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <span
        className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border ${
          selected ? "border-brand bg-brand text-white" : "border-slate-300"
        }`}
      >
        {selected && <Check width={11} height={11} strokeWidth={3} />}
      </span>
      <span>
        <span className="block text-sm font-medium text-slate-800">{title}</span>
        <span className="block text-xs text-slate-500">{desc}</span>
      </span>
    </button>
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
