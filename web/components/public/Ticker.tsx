"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export interface TickerItem {
  tag: string;
  title: string;
  href: string;
}

// The single-line rotating headline in the dark utility bar. Cross-fades every ~4.6s; the
// .ticker-fade class disables the animation under prefers-reduced-motion (globals.css).
export default function Ticker({ items }: { items: TickerItem[] }) {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (items.length <= 1) return;
    const rotate = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setIndex((i) => (i + 1) % items.length);
        setFading(false);
      }, 200);
    }, 4600);
    return () => clearInterval(rotate);
  }, [items.length]);

  if (items.length === 0) return null;
  const current = items[index];

  return (
    <div className="flex h-9 min-w-0 flex-1 items-center overflow-hidden">
      <Link
        href={current.href}
        className="ticker-fade flex min-w-0 items-center gap-2.5 whitespace-nowrap text-[11px] text-[#ededed] transition-opacity duration-200 hover:text-white"
        style={{ opacity: fading ? 0 : 1 }}
      >
        <span className="font-bold uppercase tracking-[0.08em] text-accent">{current.tag}</span>
        <span className="overflow-hidden text-ellipsis">{current.title}</span>
      </Link>
    </div>
  );
}
