"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Close } from "./icons";

export interface NavItem {
  label: string;
  href: string;
  active?: boolean;
}

// Off-canvas primary navigation for tablet/mobile. Scrim + click-out + ESC close.
export default function MobileMenu({
  open,
  onClose,
  nav,
}: {
  open: boolean;
  onClose: () => void;
  nav: NavItem[];
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div onMouseDown={onClose} className="fixed inset-0 z-[120] bg-[rgba(17,17,17,0.55)] lg:hidden">
      <nav
        onMouseDown={(e) => e.stopPropagation()}
        aria-label="Primary"
        className="ml-auto flex h-full w-[280px] max-w-[85%] flex-col bg-surface p-6 shadow-[0_16px_48px_rgba(17,17,17,0.18)]"
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="font-serif text-[20px] font-bold text-ink-900">Menu</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-10 w-10 items-center justify-center text-ink-900"
          >
            <Close />
          </button>
        </div>
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            onClick={onClose}
            className={`border-b border-line py-3 text-[15px] font-medium ${n.active ? "text-accent" : "text-ink-900"}`}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
