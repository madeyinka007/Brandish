"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createCategory, type ApiError } from "@/lib/categories";
import { SWATCHES, DEFAULT_COLOR, ColorDot, slugify, type CatStatus } from "@/components/admin/category-ui";
import { ArrowLeft, Check, Save } from "@/components/admin/icons";

const DESC_MAX = 160;
const META_MAX = 60;

function messageFor(err: ApiError): string {
  if (err.code === "NAME_EXISTS") return "A category with that name already exists.";
  if (err.status === 400) return err.message || "Please check the form and try again.";
  if (err.status === 500) return "The server couldn't create the category. Please try again.";
  return err.message || "Unable to create category.";
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
        checked ? "bg-brand" : "bg-slate-200"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export default function AddCategoryPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [visible, setVisible] = useState(true);
  const [inNav, setInNav] = useState(false); // UI-only (not persisted)
  const [featured, setFeatured] = useState(false); // UI-only (not persisted)
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slug = useMemo(() => slugify(name), [name]);
  const canSubmit = name.trim() !== "" && slug !== "";

  async function submit(status: CatStatus) {
    setError(null);
    if (!canSubmit) {
      setError("Enter a category name with at least one letter or number.");
      return;
    }
    setSaving(true);
    try {
      await createCategory({
        name: name.trim(),
        description: description.trim(),
        color,
        status,
        seo: { title: metaTitle.trim(), description: metaDescription.trim() },
      });
      router.push("/admin/categories");
    } catch (err) {
      setError(messageFor(err as ApiError));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit(visible ? "active" : "hidden"); }} className="mx-auto max-w-6xl">
      {/* breadcrumb + header */}
      <nav className="mb-3 flex items-center gap-1.5 text-sm text-slate-400">
        <Link href="/admin/categories" className="hover:text-slate-600">
          Categories
        </Link>
        <span>›</span>
        <span className="text-slate-600">Add Category</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            href="/admin/categories"
            className="mt-1 rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50"
            aria-label="Back to categories"
          >
            <ArrowLeft width={18} height={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Add Category</h1>
            <p className="mt-1 text-sm text-slate-500">
              Create a topic for grouping content. Categories are flat — no parents or sub-categories.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/categories"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving || !canSubmit}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save width={16} height={16} />
            {saving ? "Creating…" : "Create category"}
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
          {/* details */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Category details</h2>
            <p className="text-sm text-slate-500">The name and description shown to readers and editors.</p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Category name <span className="text-rose-500">*</span>
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Growth Marketing"
                  className={inputCls}
                  autoFocus
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Slug</label>
                <div className="flex items-center overflow-hidden rounded-lg border border-slate-300 bg-slate-50">
                  <span className="whitespace-nowrap px-3 py-2 text-sm text-slate-400">brandish.co/category/</span>
                  <span className="flex-1 py-2 pr-3 font-mono text-sm text-slate-700">{slug || "…"}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Generated from the name — the slug is set server-side and is permanent once created.
                </p>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">Description</label>
                  <span className="text-xs text-slate-400">
                    {description.length} / {DESC_MAX}
                  </span>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))}
                  rows={3}
                  placeholder="Playbooks and case studies on acquisition, retention and lifecycle marketing."
                  className={`${inputCls} resize-none`}
                />
                <p className="mt-1 text-xs text-slate-400">Appears on category archive pages and in search results.</p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Label colour</label>
                <div className="flex flex-wrap gap-2.5">
                  {SWATCHES.map((s) => (
                    <button
                      type="button"
                      key={s.value}
                      onClick={() => setColor(s.value)}
                      aria-label={s.name}
                      className={`h-7 w-7 rounded-full transition ${
                        color === s.value ? "ring-2 ring-slate-900 ring-offset-2" : ""
                      }`}
                      style={{ backgroundColor: s.value }}
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-400">Used for the swatch in lists and category chips.</p>
              </div>
            </div>
          </section>

          {/* search & metadata */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Search &amp; metadata</h2>
            <p className="text-sm text-slate-500">Overrides what search engines show for this category.</p>

            <div className="mt-4 space-y-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">Meta title</label>
                  <span className="text-xs text-slate-400">
                    {metaTitle.length} / {META_MAX}
                  </span>
                </div>
                <input
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value.slice(0, META_MAX))}
                  placeholder={name ? `${name} — Brandish` : "Growth Marketing — Brandish"}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Meta description</label>
                <textarea
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  rows={2}
                  placeholder="A one-line summary shown in search engine results."
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>
          </section>

          {/* visibility */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Visibility &amp; display</h2>
            <p className="text-sm text-slate-500">Where this category appears across the site.</p>

            <div className="mt-4 divide-y divide-slate-100">
              <ToggleRow
                title="Visible on site"
                desc="Show this category on archive pages and post metadata."
                checked={visible}
                onChange={setVisible}
              />
              <ToggleRow
                title="Include in main navigation"
                desc="Add it to the site header menu. (Not stored yet.)"
                checked={inNav}
                onChange={setInNav}
              />
              <ToggleRow
                title="Feature on homepage"
                desc="Surface recent posts from this category on the homepage. (Not stored yet.)"
                checked={featured}
                onChange={setFeatured}
              />
            </div>
          </section>

          {/* bottom bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4">
            <p className="text-xs text-slate-400">Required fields are marked with an asterisk.</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void submit("hidden")}
                disabled={saving || !canSubmit}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                Save as draft
              </button>
              <button
                type="button"
                onClick={() => void submit(visible ? "active" : "hidden")}
                disabled={saving || !canSubmit}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
              >
                {saving ? "Creating…" : "Create category"}
              </button>
            </div>
          </div>
        </div>

        {/* preview column */}
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Preview</h2>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5">
              <ColorDot color={color} />
              <span className="text-sm font-medium text-slate-700">{name || "Category name"}</span>
            </div>
            <div className="mt-4 rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-400">Public URL</p>
              <p className="truncate text-sm font-medium text-brand">brandish.co/category/{slug || "…"}</p>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <Row k="Slug" v={slug || "—"} mono />
              <Row k="Status" v={visible ? "Visible" : "Hidden"} vClass={visible ? "text-emerald-600" : "text-slate-500"} />
              <Row k="Posts" v="0" />
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 bg-brand-soft/40 p-5">
            <h2 className="font-semibold text-slate-900">Before you save</h2>
            <ul className="mt-3 space-y-2.5 text-sm text-slate-600">
              {[
                "The slug is permanent once posts are published — the server keeps it fixed.",
                "Every category is top level — use tags for topics that span several categories.",
                "Hidden categories still exist and can be referenced; they're just out of public nav.",
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
    </form>
  );
}

/* ------------------------------ small pieces ------------------------------ */

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/30";

function ToggleRow({
  title,
  desc,
  checked,
  onChange,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div>
        <p className="text-sm font-medium text-slate-800">{title}</p>
        <p className="text-xs text-slate-400">{desc}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function Row({ k, v, vClass = "text-slate-800", mono }: { k: string; v: string; vClass?: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{k}</dt>
      <dd className={`font-medium ${mono ? "font-mono text-xs" : ""} ${vClass}`}>{v}</dd>
    </div>
  );
}
