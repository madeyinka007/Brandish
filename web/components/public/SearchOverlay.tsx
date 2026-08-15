"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, MoodEmpty, Search } from "./icons";

export interface SearchItem {
  title: string;
  categoryLabel: string;
  date: string;
  href: string;
}

// Full-screen search over the posts already loaded on the page (there's no search API yet).
// Scrim + ESC + click-out close, body scroll locked, input auto-focused. Popular chips seed the query.
export default function SearchOverlay({
  open,
  onClose,
  items,
  chips,
}: {
  open: boolean;
  onClose: () => void;
  items: SearchItem[];
  chips: string[];
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const focus = setTimeout(() => inputRef.current?.focus(), 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(focus);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const q = query.trim().toLowerCase();
  const results = useMemo(
    () =>
      q === ""
        ? items.slice(0, 5)
        : items.filter((r) => `${r.title} ${r.categoryLabel}`.toLowerCase().includes(q)).slice(0, 6),
    [q, items],
  );

  if (!open) return null;
  const noResults = q !== "" && results.length === 0;

  return (
    <div
      onMouseDown={onClose}
      className="fixed inset-0 z-[120] flex items-start justify-center bg-[rgba(17,17,17,0.55)] p-4 pt-24 sm:p-6 sm:pt-[120px]"
      role="dialog"
      aria-modal="true"
      aria-label="Search Brandish"
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="flex w-full max-w-[720px] flex-col gap-5 rounded bg-surface p-6 shadow-[0_16px_48px_rgba(17,17,17,0.18)] sm:p-10"
      >
        <div className="flex items-center gap-4 border-b-2 border-ink-900 pb-3">
          <span className="text-ink-400">
            <Search size={22} />
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Brandish…"
            className="flex-1 border-0 bg-transparent font-serif text-[20px] text-ink-900 outline-none placeholder:text-ink-400 sm:text-[22px]"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-line px-2.5 py-1.5 text-[11px] font-bold tracking-[0.08em] text-ink-400 transition-colors hover:border-ink-900 hover:text-ink-900"
          >
            ESC
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
            {q === "" ? "Latest stories" : `${results.length} result${results.length === 1 ? "" : "s"} for “${query}”`}
          </div>
          {noResults ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <span className="text-ink-300">
                <MoodEmpty size={24} />
              </span>
              <span className="text-[14px] text-ink-500">No stories match “{query}”.</span>
            </div>
          ) : (
            results.map((r, i) => (
              <Link
                key={`${r.href}-${i}`}
                href={r.href}
                onClick={onClose}
                className="group -mx-2 flex items-center gap-4 rounded-sm p-2 transition-colors hover:bg-surface-alt"
              >
                <span className="hatch h-14 w-14 shrink-0" aria-hidden="true" />
                <span className="flex flex-1 flex-col gap-1">
                  <span className="font-serif text-[16px] font-bold leading-[1.35] text-ink-900">{r.title}</span>
                  <span className="flex items-center gap-2 text-[12px]">
                    <span className="font-bold uppercase tracking-[0.08em] text-accent">{r.categoryLabel}</span>
                    <span className="text-ink-300">—</span>
                    <span className="text-ink-400">{r.date}</span>
                  </span>
                </span>
                <span className="text-ink-300 transition-colors group-hover:text-accent">
                  <ArrowUpRight size={18} />
                </span>
              </Link>
            ))
          )}
        </div>

        {chips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">
            <span className="mr-2 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">Popular</span>
            {chips.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setQuery(c)}
                className="rounded-full border border-line px-3.5 py-1.5 text-[13px] text-ink-700 transition-colors hover:border-accent hover:bg-accent hover:text-white"
              >
                {c}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
