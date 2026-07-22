"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { listMedia, uploadFile, createFromUrl, deleteMedia, type MediaRecord, type ApiError } from "@/lib/media";
import {
  Thumbnail,
  mediaCategory,
  formatBytes,
  filenameOf,
  CATEGORY_LABEL,
  type MediaCategory,
} from "@/components/admin/media-ui";
import { formatDate } from "@/components/admin/user-ui";
import {
  Copy,
  Download,
  Folder,
  HardDrive,
  ImageIcon,
  Link2,
  Trash,
  Upload,
  X,
} from "@/components/admin/icons";

type TabKey = "all" | MediaCategory;
const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "image", label: "Images" },
  { key: "video", label: "Video" },
  { key: "document", label: "Documents" },
  { key: "audio", label: "Audio" },
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
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
    </div>
  );
}

export default function MediaPage() {
  const [media, setMedia] = useState<MediaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const [urlOpen, setUrlOpen] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [urlBusy, setUrlBusy] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setMedia(await listMedia());
    } catch (e) {
      setError((e as Error).message || "Failed to load media");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const counts = useMemo(() => {
    const byCat: Record<MediaCategory, number> = { image: 0, video: 0, audio: 0, document: 0 };
    let storage = 0;
    let week = 0;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const m of media) {
      byCat[mediaCategory(m.mimeType)]++;
      storage += m.size ?? 0;
      if (new Date(m.createdAt).getTime() >= weekAgo) week++;
    }
    return { total: media.length, byCat, storage, week };
  }, [media]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return media.filter((m) => {
      if (tab !== "all" && mediaCategory(m.mimeType) !== tab) return false;
      if (!q) return true;
      return filenameOf(m).toLowerCase().includes(q) || m.url.toLowerCase().includes(q);
    });
  }, [media, tab, query]);

  const selected = media.find((m) => m._id === selectedId) ?? null;

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setError(null);
    setNotice(null);
    setUploading(true);
    try {
      const created = await uploadFile(file);
      await load();
      setSelectedId(created._id);
      setNotice(`Uploaded ${file.name}.`);
    } catch (err) {
      const ae = err as ApiError;
      setError(
        ae.status === 500 || ae.code === "INVALID_UPLOAD_REQUEST"
          ? "Direct upload needs S3/CloudFront configured (not available locally). Use “Add by URL” instead."
          : ae.message || "Upload failed.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function onAddUrl(e: React.FormEvent) {
    e.preventDefault();
    setUrlError(null);
    const url = urlValue.trim();
    if (!/^https?:\/\//i.test(url)) {
      setUrlError("Enter a full http(s) image URL.");
      return;
    }
    setUrlBusy(true);
    try {
      const created = await createFromUrl(url);
      await load();
      setSelectedId(created._id);
      setUrlOpen(false);
      setUrlValue("");
      setNotice("Added media from URL.");
    } catch (err) {
      const ae = err as ApiError;
      setUrlError(
        ae.code === "INVALID_MEDIA_URL"
          ? "That URL didn’t resolve to a reachable image."
          : ae.message || "Couldn’t add that URL.",
      );
    } finally {
      setUrlBusy(false);
    }
  }

  async function onDelete(m: MediaRecord) {
    if (!window.confirm(`Delete “${filenameOf(m)}”? This cannot be undone.`)) return;
    try {
      await deleteMedia(m._id);
      if (selectedId === m._id) setSelectedId(null);
      await load();
    } catch (err) {
      setError((err as ApiError).message || "Delete failed.");
    }
  }

  function copyUrl(url: string) {
    void navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Media Library</h1>
          <p className="mt-1 text-sm text-slate-500">Images, video and documents used across Brandish content.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setUrlOpen(true);
              setUrlError(null);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <Link2 width={16} height={16} /> Add by URL
          </button>
          <button
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
          >
            <Upload width={16} height={16} /> {uploading ? "Uploading…" : "Upload files"}
          </button>
          <input ref={fileInput} type="file" hidden onChange={onUpload} />
        </div>
      </div>

      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>
      )}
      {error && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* stat cards (real, derived) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Folder} label="Total Files" value={String(counts.total)} sub="in the library" tone="bg-brand-soft text-brand" />
        <StatCard icon={HardDrive} label="Storage Used" value={formatBytes(counts.storage)} sub="known file sizes" tone="bg-blue-50 text-blue-600" />
        <StatCard icon={ImageIcon} label="Images" value={String(counts.byCat.image)} sub="image assets" tone="bg-emerald-50 text-emerald-600" />
        <StatCard icon={Upload} label="Uploaded This Week" value={String(counts.week)} sub="last 7 days" tone="bg-amber-50 text-amber-600" />
      </div>

      {/* tabs + search */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => {
            const n = t.key === "all" ? counts.total : counts.byCat[t.key];
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
          placeholder="Search media…"
          className="w-56 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20"
        />
      </div>

      {/* grid + details */}
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-400">
              Loading media…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-400">
              {media.length === 0 ? "No media yet." : "No media matches your filters."}
              <button onClick={() => setUrlOpen(true)} className="font-medium text-brand hover:underline">
                Add by URL
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {filtered.map((m) => {
                const isSel = m._id === selectedId;
                return (
                  <button
                    key={m._id}
                    onClick={() => setSelectedId(m._id)}
                    className={`group overflow-hidden rounded-xl border bg-white text-left transition ${
                      isSel ? "border-brand ring-2 ring-brand/30" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                      <Thumbnail media={m} />
                      <span className="absolute left-2 top-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-medium uppercase text-white">
                        {CATEGORY_LABEL[mediaCategory(m.mimeType)]}
                      </span>
                    </div>
                    <div className="p-2.5">
                      <p className="truncate text-sm font-medium text-slate-800">{filenameOf(m)}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {formatBytes(m.size)} · {m.source === "url" ? "URL" : "Upload"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <p className="mt-4 text-center text-sm text-slate-400">
              Showing {filtered.length} of {media.length} files
            </p>
          )}
        </div>

        {/* details panel */}
        {selected && (
          <aside className="w-full shrink-0 self-start rounded-xl border border-slate-200 bg-white p-5 lg:w-80">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Asset details</h2>
              <button
                onClick={() => setSelectedId(null)}
                aria-label="Close"
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X width={16} height={16} />
              </button>
            </div>

            <div className="mt-4 aspect-[4/3] overflow-hidden rounded-lg bg-slate-100">
              <Thumbnail media={selected} iconSize={40} />
            </div>

            <p className="mt-3 truncate font-medium text-slate-800" title={filenameOf(selected)}>
              {filenameOf(selected)}
            </p>
            <p className="text-xs text-slate-400">Added {formatDate(selected.createdAt)}</p>

            <dl className="mt-4 space-y-2.5 text-sm">
              <Row k="Type" v={selected.mimeType || CATEGORY_LABEL[mediaCategory(selected.mimeType)]} />
              <Row k="Size" v={formatBytes(selected.size)} />
              <Row k="Source" v={selected.source === "url" ? "External URL" : "Uploaded (S3)"} />
            </dl>

            <label className="mt-4 block text-xs font-medium text-slate-500">URL</label>
            <div className="mt-1 flex items-center gap-1.5">
              <input
                readOnly
                value={selected.url}
                className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600"
              />
              <button
                onClick={() => copyUrl(selected.url)}
                title="Copy URL"
                className="shrink-0 rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
              >
                <Copy width={15} height={15} />
              </button>
            </div>
            {copied && <p className="mt-1 text-xs text-emerald-600">Copied to clipboard.</p>}

            <div className="mt-4 flex items-center gap-2">
              <a
                href={selected.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <Download width={15} height={15} /> Open
              </a>
              <button
                onClick={() => onDelete(selected)}
                title="Delete"
                className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50"
              >
                <Trash width={16} height={16} />
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* Add-by-URL modal */}
      {urlOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setUrlOpen(false)}
        >
          <form
            onSubmit={onAddUrl}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Add media by URL</h2>
              <button type="button" onClick={() => setUrlOpen(false)} aria-label="Close" className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
                <X width={16} height={16} />
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Paste a public image URL. The server validates that it resolves to a reachable image.
            </p>
            <input
              autoFocus
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              placeholder="https://example.com/photo.jpg"
              className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
            {urlError && <p className="mt-2 text-sm text-rose-600">{urlError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUrlOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={urlBusy}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
              >
                {urlBusy ? "Adding…" : "Add media"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{k}</dt>
      <dd className="min-w-0 truncate font-medium text-slate-800" title={v}>
        {v}
      </dd>
    </div>
  );
}
