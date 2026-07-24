"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ComponentType, SVGProps } from "react";
import { getStoredUser, logout } from "@/lib/auth";
import { listComments } from "@/lib/comments";
import { listPosts } from "@/lib/posts";
import {
  BarChart,
  FileText,
  Folder,
  ImageIcon,
  LayoutGrid,
  ListTree,
  LogOut,
  MessageSquare,
  Send,
  Settings,
  Users,
} from "./icons";

type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  badge?: number;
};

// Badges are filled in at render time from live counts (see loadBadges below), keyed by href.
const MAIN: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutGrid },
  { label: "Content", href: "/admin/posts", icon: FileText },
  { label: "Category", href: "/admin/categories", icon: Folder },
  { label: "Taxonomy", href: "/admin/taxonomy", icon: ListTree },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Media", href: "/admin/media", icon: ImageIcon },
  { label: "Comments", href: "/admin/comments", icon: MessageSquare },
];

/** Event admin pages fire after a mutation so the sidebar badges refresh without a full reload. */
export const BADGE_REFRESH_EVENT = "admin:refresh-badges";

const TOOLS: NavItem[] = [
  { label: "Campaign", href: "/admin/campaign", icon: Send },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = getStoredUser();
  const [signingOut, setSigningOut] = useState(false);
  // Live counts: Comments = pending moderation queue, Content = draft posts.
  const [badges, setBadges] = useState<{ comments: number; content: number }>({ comments: 0, content: 0 });

  useEffect(() => {
    let cancelled = false;
    async function loadBadges() {
      const [comments, posts] = await Promise.all([
        listComments().catch(() => []),
        listPosts().catch(() => []),
      ]);
      if (cancelled) return;
      setBadges({
        comments: comments.filter((c) => c.status === "pending").length,
        content: posts.filter((p) => p.status === "draft").length,
      });
    }
    void loadBadges();
    const onRefresh = () => void loadBadges();
    window.addEventListener(BADGE_REFRESH_EVENT, onRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener(BADGE_REFRESH_EVENT, onRefresh);
    };
    // Re-run on navigation so counts stay fresh after actions on other pages.
  }, [pathname]);

  const badgeFor = (href: string): number | undefined => {
    const n = href === "/admin/comments" ? badges.comments : href === "/admin/posts" ? badges.content : 0;
    return n > 0 ? n : undefined;
  };

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  async function onSignOut() {
    setSigningOut(true);
    await logout();
    router.replace("/admin/login");
  }

  const renderItem = (item: NavItem) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    const badge = item.badge ?? badgeFor(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
          active ? "bg-brand text-white" : "text-slate-400 hover:bg-sidebar-accent hover:text-white"
        }`}
      >
        <Icon width={18} height={18} />
        <span className="flex-1">{item.label}</span>
        {badge != null && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
              active ? "bg-white/20 text-white" : "bg-rose-500 text-white"
            }`}
          >
            {badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-sidebar text-white">
      <div className="flex items-center gap-3 px-6 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-lg font-bold">
          B
        </span>
        <span className="text-lg font-semibold">Brandish</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <p className="px-3 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Main
        </p>
        <div className="space-y-1">{MAIN.map(renderItem)}</div>

        <p className="px-3 pb-2 pt-6 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Tools
        </p>
        <div className="space-y-1">{TOOLS.map(renderItem)}</div>
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-semibold">
            {user ? initials(user.name) : "?"}
          </span>
          <span className="min-w-0 flex-1 text-xs">
            <span className="block truncate font-semibold text-white">
              {user?.name ?? "Signed out"}
            </span>
            <span className="block truncate capitalize text-slate-400">
              {user?.role?.replace("-", " ") ?? ""}
            </span>
          </span>
          <button
            onClick={onSignOut}
            disabled={signingOut}
            title="Sign out"
            aria-label="Sign out"
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            <LogOut width={16} height={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
