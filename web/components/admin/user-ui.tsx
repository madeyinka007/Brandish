// Shared UI + mapping helpers for the Users pages. Roles are the real system roles
// (super-admin | editor | author | reader). "Status" is derived from the API's `active` +
// `emailVerified` booleans, since the backend has no explicit status enum.

export type Role = "super-admin" | "editor" | "author" | "reader";

export const ROLE_META: Record<Role, { label: string; badge: string; blurb: string }> = {
  "super-admin": {
    label: "Super Admin",
    badge: "bg-indigo-50 text-indigo-700",
    blurb: "Full access to settings, users and all content.",
  },
  editor: {
    label: "Editor",
    badge: "bg-blue-50 text-blue-700",
    blurb: "Publish and edit all content, moderate comments.",
  },
  author: {
    label: "Author",
    badge: "bg-slate-100 text-slate-600",
    blurb: "Create and publish their own content only.",
  },
  reader: {
    label: "Reader",
    badge: "bg-slate-100 text-slate-600",
    blurb: "Read content and post comments.",
  },
};

export const ROLE_ORDER: Role[] = ["super-admin", "editor", "author", "reader"];

export type Status = "Active" | "Pending" | "Suspended";

export function statusOf(u: { active: boolean; emailVerified: boolean }): Status {
  if (!u.active) return "Suspended";
  if (!u.emailVerified) return "Pending";
  return "Active";
}

export const STATUS_META: Record<Status, string> = {
  Active: "bg-emerald-50 text-emerald-700",
  Pending: "bg-amber-50 text-amber-700",
  Suspended: "bg-rose-50 text-rose-700",
};

export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

const AVATAR_COLORS = [
  "bg-indigo-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-pink-500",
  "bg-blue-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-violet-500",
];

export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function Avatar({
  name,
  src,
  size = 36,
  className = "",
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={`inline-block shrink-0 rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${avatarColor(name)} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const meta = ROLE_META[role] ?? { label: role, badge: "bg-slate-100 text-slate-600" };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.badge}`}>
      {meta.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_META[status]}`}>
      {status}
    </span>
  );
}

/** "Jul 18, 2026" */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
