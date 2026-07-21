"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCategory, updateCategory, type CategoryRecord, type ApiError } from "@/lib/categories";
import { SWATCHES, DEFAULT_COLOR, ColorDot } from "@/components/admin/category-ui";
import { ArrowLeft, Save } from "@/components/admin/icons";

const DESC_MAX = 160;
const META_MAX = 60;

function messageFor(err: ApiError): string {
  if (err.code === "NAME_EXISTS") return "A category with that name already exists.";
  if (err.code === "CATEGORY_NOT_FOUND") return "This category no longer exists.";
  if (err.status === 400) return err.message || "Please check the form and try again.";
  if (err.status === 500) return "The server couldn't save the changes. Please try again.";
  return err.message || "Unable to save changes.";
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-brand" : "bg-slate-200"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export default function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [original, setOriginal] = useState<CategoryRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [visible, setVisible] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const c = await getCategory(id);
        if (!alive) return;
        if (!c) {
          setLoadError("Category not found.");
          return;
        }
        setOriginal(c);
        setName(c.name);
        setDescription(c.description ?? "");
        setColor(c.color || DEFAULT_COLOR);
        setMetaTitle(c.seo?.title ?? "");
        setMetaDescription(c.seo?.description ?? "");
        setVisible(c.status === "active");
      } catch (e) {
        if (alive) setLoadError((e as Error).message || "Failed to load category");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const changes = useMemo(() => {
    if (!original) return { any: false };
    const any =
      name.trim() !== original.name ||
      description.trim() !== (original.description ?? "") ||
      color !== (original.color || DEFAULT_COLOR) ||
      metaTitle.trim() !== (original.seo?.title ?? "") ||
      metaDescription.trim() !== (original.seo?.description ?? "") ||
      visible !== (original.status === "active");
    return { any };
  }, [original, name, description, color, metaTitle, metaDescription, visible]);

  const canSave = !!original && name.trim() !== "" && changes.any;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!original || !canSave) return;
    setSaving(true);
    try {
      await updateCategory(original._id, {
        name: name.trim(),
        description: description.trim(),
        color,
        status: visible ? "active" : "hidden",
        seo: {
          title: metaTitle.trim(),
          description: metaDescription.trim(),
          keywords: original.seo?.keywords ?? "",
          ogImage: original.seo?.ogImage ?? "",
        },
      });
      router.push("/admin/categories");
    } catch (err) {
      setError(messageFor(err as ApiError));
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-sm text-slate-400">Loading category…</div>;
  }
  if (loadError || !original) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">{loadError ?? "Category not found."}</p>
        <Link href="/admin/categories" className="mt-4 inline-block text-sm font-medium text-brand hover:text-brand-dark">
          ← Back to categories
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-6xl">
      {/* breadcrumb + header */}
      <nav className="mb-3 flex items-center gap-1.5 text-sm text-slate-400">
        <Link href="/admin/categories" className="hover:text-slate-600">
          Categories
        </Link>
        <span>›</span>
        <span className="text-slate-600">Edit Category</span>
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
            <h1 className="text-2xl font-bold text-slate-900">Edit Category</h1>
            <p className="mt-1 text-sm text-slate-500">Update the name, description, colour and visibility.</p>
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
          {/* details */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Category details</h2>
            <p className="text-sm text-slate-500">The name and description shown to readers and editors.</p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Category name <span className="text-rose-500">*</span>
                </label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Slug</label>
                <div className="flex items-center overflow-hidden rounded-lg border border-slate-300 bg-slate-50">
                  <span className="whitespace-nowrap px-3 py-2 text-sm text-slate-400">brandish.co/category/</span>
                  <span className="flex-1 py-2 pr-3 font-mono text-sm text-slate-700">{original.slug}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  The slug is permanent — renaming the category leaves it unchanged so existing links keep working.
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
                  className={`${inputCls} resize-none`}
                />
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
                  placeholder={`${name || "Category"} — Brandish`}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Meta description</label>
                <textarea
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>
          </section>

          {/* visibility */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold text-slate-900">Visible on site</h2>
                <p className="text-sm text-slate-500">Show this category on archive pages and post metadata.</p>
              </div>
              <Toggle checked={visible} onChange={setVisible} />
            </div>
          </section>
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
              <p className="truncate text-sm font-medium text-brand">brandish.co/category/{original.slug}</p>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <Row k="Slug" v={original.slug} mono />
              <Row k="Status" v={visible ? "Visible" : "Hidden"} vClass={visible ? "text-emerald-600" : "text-slate-500"} />
            </dl>
            {!changes.any && <p className="mt-4 text-xs text-slate-400">No changes yet.</p>}
          </section>
        </div>
      </div>
    </form>
  );
}

/* ------------------------------ small pieces ------------------------------ */

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/30";

function Row({ k, v, vClass = "text-slate-800", mono }: { k: string; v: string; vClass?: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{k}</dt>
      <dd className={`font-medium ${mono ? "font-mono text-xs" : ""} ${vClass}`}>{v}</dd>
    </div>
  );
}
