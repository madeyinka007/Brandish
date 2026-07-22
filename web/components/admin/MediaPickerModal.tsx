"use client";

import { useEffect, useState } from "react";
import { listMedia, type MediaRecord } from "@/lib/media";
import { mediaCategory, filenameOf, Thumbnail } from "@/components/admin/media-ui";
import { Link2, X } from "@/components/admin/icons";

/**
 * Modal to pick an image from the media library. Calls `onSelect(url)` with the chosen image
 * URL (also supports pasting a direct URL, which is the same underlying avatar value).
 */
export default function MediaPickerModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}) {
  const [media, setMedia] = useState<MediaRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [urlValue, setUrlValue] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setQuery("");
    setUrlValue("");
    listMedia()
      .then(setMedia)
      .catch((e) => setError((e as Error).message || "Failed to load media"))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const images = media.filter(
    (m) => mediaCategory(m.mimeType) === "image" && (!q || filenameOf(m).toLowerCase().includes(q)),
  );

  function choose(url: string) {
    onSelect(url);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <h2 className="font-semibold text-slate-900">Choose an avatar</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X width={16} height={16} />
          </button>
        </div>

        {/* search */}
        <div className="border-b border-slate-100 p-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search images…"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20"
          />
        </div>

        {/* grid */}
        <div className="min-h-[220px] flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-400">Loading media…</div>
          ) : error ? (
            <div className="flex h-40 items-center justify-center text-sm text-rose-600">{error}</div>
          ) : images.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-1 text-sm text-slate-400">
              {media.length === 0 ? "No media yet." : "No images match your search."}
              <span className="text-xs">Paste a URL below, or add media in the Media Library.</span>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {images.map((m) => (
                <button
                  key={m._id}
                  type="button"
                  onClick={() => choose(m.url)}
                  title={filenameOf(m)}
                  className="group overflow-hidden rounded-lg border border-slate-200 transition hover:border-brand hover:ring-2 hover:ring-brand/30"
                >
                  <div className="aspect-square overflow-hidden bg-slate-100">
                    <Thumbnail media={m} iconSize={22} />
                  </div>
                  <p className="truncate px-2 py-1 text-[11px] text-slate-500">{filenameOf(m)}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* paste-URL fallback */}
        <div className="border-t border-slate-100 p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const url = urlValue.trim();
              if (/^https?:\/\//i.test(url)) choose(url);
            }}
            className="flex items-center gap-2"
          >
            <span className="text-slate-400">
              <Link2 width={16} height={16} />
            </span>
            <input
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              placeholder="…or paste an image URL"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <button
              type="submit"
              disabled={!/^https?:\/\//i.test(urlValue.trim())}
              className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
            >
              Use
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
