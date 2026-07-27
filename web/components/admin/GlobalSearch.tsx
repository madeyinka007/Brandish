"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { listPosts, type PostRecord } from "@/lib/posts";
import { listUsers, type UserRecord } from "@/lib/users";
import { listCategories, type CategoryRecord } from "@/lib/categories";
import { listTags, type TagRecord } from "@/lib/tags";
import { listMedia, type MediaRecord } from "@/lib/media";
import { FileText, Folder, ImageIcon, Search, Tag, Users } from "./icons";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;
type Group = "Posts" | "Users" | "Categories" | "Tags" | "Media";

interface Result {
  id: string;
  group: Group;
  label: string;
  sub: string;
  href: string;
  icon: Icon;
}

const PER_GROUP = 5;

interface Data {
  posts: PostRecord[];
  users: UserRecord[];
  categories: CategoryRecord[];
  tags: TagRecord[];
  media: MediaRecord[];
}
const EMPTY: Data = { posts: [], users: [], categories: [], tags: [], media: [] };

export default function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState(0);
  const data = useRef<Data>(EMPTY);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Lazy-load the admin datasets once, on first focus. Each is independent — a failed one
  // (e.g. users is super-admin-only, 403 for editors) just drops that group.
  async function ensureLoaded() {
    if (loaded || loading) return;
    setLoading(true);
    const [posts, users, categories, tags, media] = await Promise.all([
      listPosts().catch(() => []),
      listUsers().catch(() => []),
      listCategories().catch(() => []),
      listTags().catch(() => []),
      listMedia().catch(() => []),
    ]);
    data.current = { posts, users, categories, tags, media };
    setLoaded(true);
    setLoading(false);
  }

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const { posts, users, categories, tags, media } = data.current;
    const out: Result[] = [];

    posts
      .filter((p) => p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
      .slice(0, PER_GROUP)
      .forEach((p) =>
        out.push({ id: p._id, group: "Posts", label: p.title, sub: p.status, href: `/admin/posts/${p._id}/edit`, icon: FileText }),
      );

    users
      .filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .slice(0, PER_GROUP)
      .forEach((u) => out.push({ id: u._id, group: "Users", label: u.name, sub: u.email, href: `/admin/users/${u._id}/edit`, icon: Users }));

    categories
      .filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q))
      .slice(0, PER_GROUP)
      .forEach((c) => out.push({ id: c._id, group: "Categories", label: c.name, sub: `/${c.slug}`, href: `/admin/categories/${c._id}/edit`, icon: Folder }));

    tags
      .filter((t) => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q))
      .slice(0, PER_GROUP)
      .forEach((t) => out.push({ id: t._id, group: "Tags", label: t.name, sub: `${t.postCount} post${t.postCount === 1 ? "" : "s"}`, href: `/admin/taxonomy`, icon: Tag }));

    media
      .filter((m) => (m.filename ?? "").toLowerCase().includes(q))
      .slice(0, PER_GROUP)
      .forEach((m) => out.push({ id: m._id, group: "Media", label: m.filename ?? "Untitled", sub: m.mimeType ?? "file", href: `/admin/media`, icon: ImageIcon }));

    return out;
  }, [query, loaded]);

  useEffect(() => setActive(0), [query]);

  // Close on outside click.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function go(r: Result) {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(r.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[active];
      if (r) go(r);
    }
  }

  const showPanel = open && query.trim().length > 0;

  return (
    <div ref={boxRef} className="relative flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder="Search content, users, media…"
        onFocus={() => {
          setOpen(true);
          void ensureLoaded();
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={showPanel}
        aria-controls="global-search-results"
        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-sm outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20"
      />

      {showPanel && (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg"
        >
          {loading && !loaded ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">
              No matches for &ldquo;{query.trim()}&rdquo;
            </p>
          ) : (
            results.map((r, i) => {
              const Icon = r.icon;
              const firstOfGroup = i === 0 || results[i - 1].group !== r.group;
              return (
                <div key={`${r.group}-${r.id}`}>
                  {firstOfGroup && (
                    <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{r.group}</p>
                  )}
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r)}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-left ${i === active ? "bg-brand-soft" : "hover:bg-slate-50"}`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${i === active ? "bg-white text-brand" : "bg-slate-100 text-slate-500"}`}>
                      <Icon width={14} height={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">{r.label}</span>
                      <span className="block truncate text-xs capitalize text-slate-400">{r.sub}</span>
                    </span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
