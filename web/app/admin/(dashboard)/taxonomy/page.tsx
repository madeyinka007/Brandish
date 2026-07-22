"use client";

import { useEffect, useMemo, useState } from "react";
import { listTags, createTag, updateTag, deleteTag, type TagRecord, type ApiError } from "@/lib/tags";
import { SWATCHES, DEFAULT_COLOR, ColorDot, slugify } from "@/components/admin/category-ui";
import { formatDate } from "@/components/admin/user-ui";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  ListTree,
  Pencil,
  Plus,
  Star,
  Tag,
  Trash,
  X,
} from "@/components/admin/icons";

const PAGE_SIZE = 8;
const DESC_MAX = 160;

function messageFor(err: ApiError): string {
  if (err.code === "TAG_EXISTS") return "A tag with that name already exists.";
  if (err.code === "TAG_NOT_FOUND") return "That tag no longer exists.";
  if (err.status === 400) return err.message || "Please check the form and try again.";
  if (err.status === 500) return "The server couldn't save that. Please try again.";
  return err.message || "Something went wrong.";
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: (p: { width?: number; height?: number }) => React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
        <Icon width={18} height={18} />
      </span>
      <p className="mt-4 text-sm text-slate-500">{label}</p>
      <p className="mt-1 truncate text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
    </div>
  );
}

export default function TaxonomyPage() {
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "used" | "unused">("all");
  const [sort, setSort] = useState<"name" | "newest" | "posts">("name");
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // form (create + edit share it)
  const [editId, setEditId] = useState<string | null>(null);
  const [editSlug, setEditSlug] = useState<string>("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const editing = editId !== null;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setTags(await listTags());
    } catch (e) {
      setError((e as Error).message || "Failed to load tags");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const counts = useMemo(() => {
    const used = tags.filter((t) => t.postCount > 0).length;
    const mostUsed = [...tags].sort((a, b) => b.postCount - a.postCount)[0];
    return { total: tags.length, used, unused: tags.length - used, mostUsed };
  }, [tags]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = tags.filter((t) => {
      if (tab === "used" && t.postCount === 0) return false;
      if (tab === "unused" && t.postCount > 0) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      );
    });
    return [...list].sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "posts"
          ? b.postCount - a.postCount
          : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [tags, query, tab, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query, tab, sort]);

  const slugPreview = editing ? editSlug : slugify(name);

  function resetForm() {
    setEditId(null);
    setEditSlug("");
    setName("");
    setDescription("");
    setColor(DEFAULT_COLOR);
    setFormError(null);
  }

  function startEdit(t: TagRecord) {
    setEditId(t._id);
    setEditSlug(t.slug);
    setName(t.name);
    setDescription(t.description ?? "");
    setColor(t.color || DEFAULT_COLOR);
    setFormError(null);
    setConfirmDelete(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!name.trim() || !slugify(name)) {
      setFormError("Enter a tag name with at least one letter or number.");
      return;
    }
    setSaving(true);
    try {
      const payload = { name: name.trim(), description: description.trim(), color };
      if (editing) await updateTag(editId!, payload);
      else await createTag(payload);
      await load();
      resetForm();
    } catch (err) {
      setFormError(messageFor(err as ApiError));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    setBusy(true);
    try {
      await deleteTag(id);
      if (editId === id) resetForm();
      setConfirmDelete(null);
      await load();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const rows = [
      ["Name", "Slug", "Description", "Created"],
      ...filtered.map((t) => [t.name, t.slug, t.description, formatDate(t.createdAt)]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "brandish-tags.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tags</h1>
          <p className="mt-1 text-sm text-slate-500">
            Free-form labels for cross-cutting topics. Create, edit and remove them all from this page.
          </p>
        </div>
        <button
          onClick={exportCsv}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <Download width={16} height={16} /> Export CSV
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* stat cards (real, derived) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Tag} label="Total Tags" value={String(counts.total)} sub="in the taxonomy" tone="bg-brand-soft text-brand" />
        <StatCard icon={FileText} label="Used" value={String(counts.used)} sub="attached to posts" tone="bg-emerald-50 text-emerald-600" />
        <StatCard icon={ListTree} label="Unused" value={String(counts.unused)} sub="no posts attached" tone="bg-amber-50 text-amber-600" />
        <StatCard
          icon={Star}
          label="Most Used"
          value={counts.mostUsed && counts.mostUsed.postCount > 0 ? counts.mostUsed.name : "—"}
          sub={counts.mostUsed && counts.mostUsed.postCount > 0 ? `${counts.mostUsed.postCount} posts` : "no usage yet"}
          tone="bg-blue-50 text-blue-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* left: create / edit form */}
        <form onSubmit={onSubmit} className="lg:col-span-1">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">{editing ? "Edit tag" : "Add new tag"}</h2>
            <p className="text-sm text-slate-500">
              {editing ? "The slug stays fixed so existing posts keep their link." : "New tags appear in the list immediately."}
            </p>

            {formError && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</div>}

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Tag name <span className="text-rose-500">*</span>
                </label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Retention Loops" className={inputCls} />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Slug</label>
                <div className="flex items-center overflow-hidden rounded-lg border border-slate-300 bg-slate-50">
                  <span className="whitespace-nowrap px-3 py-2 text-sm text-slate-400">/tag/</span>
                  <span className="flex-1 py-2 pr-3 font-mono text-sm text-slate-700">{slugPreview || "…"}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {editing ? "Permanent — set when the tag was created." : "Auto-filled from the name."}
                </p>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">Description</label>
                  <span className="text-xs text-slate-400">{description.length} / {DESC_MAX}</span>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))}
                  rows={3}
                  placeholder="Short note shown on the tag archive page."
                  className={`${inputCls} resize-none`}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Colour</label>
                <div className="flex flex-wrap gap-2.5">
                  {SWATCHES.map((s) => (
                    <button
                      type="button"
                      key={s.value}
                      onClick={() => setColor(s.value)}
                      aria-label={s.name}
                      className={`h-7 w-7 rounded-full transition ${color === s.value ? "ring-2 ring-slate-900 ring-offset-2" : ""}`}
                      style={{ backgroundColor: s.value }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
                >
                  {!editing && <Plus width={16} height={16} />}
                  {saving ? "Saving…" : editing ? "Save changes" : "Add tag"}
                </button>
                {editing && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>

          <p className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
            Tags are flat and unlimited. Deleting a tag removes it from posts but never deletes the posts themselves.
          </p>
        </form>

        {/* right: table */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
              <div className="flex flex-wrap gap-1">
                {([
                  { key: "all", label: "All", n: counts.total },
                  { key: "used", label: "Used", n: counts.used },
                  { key: "unused", label: "Unused", n: counts.unused },
                ] as const).map((t) => {
                  const active = tab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                        active ? "bg-brand-soft text-brand" : "text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {t.label} <span className={active ? "text-brand" : "text-slate-400"}>{t.n}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search tags…"
                  className="w-44 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20"
                />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as "name" | "newest" | "posts")}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600"
                >
                  <option value="name">Name (A–Z)</option>
                  <option value="posts">Most used</option>
                  <option value="newest">Newest first</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 pl-4 font-medium">Tag</th>
                    <th className="py-2.5 font-medium">Slug</th>
                    <th className="py-2.5 font-medium">Posts</th>
                    <th className="py-2.5 font-medium">Created</th>
                    <th className="w-24 py-2.5 pr-4 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Loading tags…</td></tr>
                  ) : pageRows.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                      {tags.length === 0 ? "No tags yet — add one on the left." : "No tags match your search."}
                    </td></tr>
                  ) : (
                    pageRows.map((t) =>
                      confirmDelete === t._id ? (
                        <tr key={t._id} className="border-b border-slate-50 bg-rose-50/50 last:border-0">
                          <td colSpan={5} className="px-4 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <span className="text-sm text-slate-700">
                                Delete <b>{t.name}</b>? It will be removed from any posts; the posts stay published.
                              </span>
                              <div className="flex gap-2">
                                <button onClick={() => setConfirmDelete(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Keep</button>
                                <button onClick={() => onDelete(t._id)} disabled={busy} className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">Delete tag</button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={t._id} className={`border-b border-slate-50 last:border-0 ${editId === t._id ? "bg-brand-soft/40" : "hover:bg-slate-50/60"}`}>
                          <td className="py-3 pl-4">
                            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1">
                              <ColorDot color={t.color} />
                              <span className="text-sm font-medium text-slate-700">{t.name}</span>
                            </span>
                          </td>
                          <td className="py-3 font-mono text-xs text-slate-500">/{t.slug}</td>
                          <td className="py-3 text-slate-600">
                            {t.postCount}
                            {t.postCount === 0 && <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Unused</span>}
                          </td>
                          <td className="py-3 text-slate-500">{formatDate(t.createdAt)}</td>
                          <td className="py-3 pr-4">
                            <div className="flex justify-end gap-1">
                              <button onClick={() => startEdit(t)} aria-label="Edit" title="Edit" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand">
                                <Pencil width={16} height={16} />
                              </button>
                              <button onClick={() => setConfirmDelete(t._id)} aria-label="Delete" title="Delete" className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                                <Trash width={16} height={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ),
                    )
                  )}
                </tbody>
              </table>
            </div>

            {!loading && filtered.length > 0 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
                <span>
                  Showing {(pageClamped - 1) * PAGE_SIZE + 1}–{Math.min(pageClamped * PAGE_SIZE, filtered.length)} of {filtered.length} tags
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pageClamped === 1} className="rounded-md border border-slate-200 p-1.5 disabled:opacity-40" aria-label="Previous page">
                    <ChevronLeft width={16} height={16} />
                  </button>
                  <span className="px-2">Page {pageClamped} / {totalPages}</span>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={pageClamped === totalPages} className="rounded-md border border-slate-200 p-1.5 disabled:opacity-40" aria-label="Next page">
                    <ChevronRight width={16} height={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/30";
