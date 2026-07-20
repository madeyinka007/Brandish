// Shared UI + mapping helpers for the Categories pages. Status maps the API's
// `active | hidden` to the design's "Visible | Hidden".

export type CatStatus = "active" | "hidden";

export const CAT_STATUS_META: Record<CatStatus, { label: string; badge: string }> = {
  active: { label: "Visible", badge: "bg-emerald-50 text-emerald-700" },
  hidden: { label: "Hidden", badge: "bg-slate-100 text-slate-600" },
};

export function CatStatusBadge({ status }: { status: CatStatus }) {
  const meta = CAT_STATUS_META[status] ?? { label: status, badge: "bg-slate-100 text-slate-600" };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.badge}`}>{meta.label}</span>;
}

/** Colour swatches shown in the Add form; the value is stored on `category.color`. */
export const SWATCHES: { name: string; value: string }[] = [
  { name: "Indigo", value: "#6366f1" },
  { name: "Emerald", value: "#10b981" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Red", value: "#ef4444" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Pink", value: "#ec4899" },
  { name: "Slate", value: "#64748b" },
];

export const DEFAULT_COLOR = SWATCHES[0].value;

export function ColorDot({ color, size = 8 }: { color?: string; size?: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, backgroundColor: color || "#cbd5e1" }}
    />
  );
}

/** Mirror of server/lib/slug.ts `slugify` — for the live slug preview (the server is authoritative). */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
