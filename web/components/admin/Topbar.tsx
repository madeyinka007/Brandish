"use client";

import Link from "next/link";
import { getStoredUser } from "@/lib/auth";
import { Bell, Plus } from "./icons";
import GlobalSearch from "./GlobalSearch";

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Topbar() {
  const user = getStoredUser();

  return (
    <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-6 py-3">
      <GlobalSearch />

      <Link
        href="/admin/posts"
        className="flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
      >
        <Plus width={16} height={16} />
        New Post
      </Link>

      <button
        aria-label="Notifications"
        className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
      >
        <Bell />
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500" />
      </button>

      <span
        className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 text-sm font-semibold text-white"
        title={user?.name}
      >
        {user ? initials(user.name) : "?"}
      </span>
    </header>
  );
}
