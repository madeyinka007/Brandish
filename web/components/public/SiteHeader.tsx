"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, SOCIAL, Search as SearchIcon } from "./icons";
import Ticker, { type TickerItem } from "./Ticker";
import ThemeToggle from "./ThemeToggle";
import SearchOverlay, { type SearchItem } from "./SearchOverlay";
import MobileMenu, { type NavItem } from "./MobileMenu";

const PAD = "px-4 sm:px-8 lg:px-16 xl:px-[120px]";

export interface HeaderProps {
  title: string;
  today: string;
  nav: NavItem[];
  ticker: TickerItem[];
  search: SearchItem[];
  chips: string[];
}

export default function SiteHeader({ title, today, nav, ticker, search, chips }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header>
      {/* Utility bar — permanent dark chrome (surface-footer stays #212121 in both themes;
          ink-900 would flip to near-white in dark mode and wash out the light text on it). */}
      <div className={`flex h-9 items-center justify-between gap-4 bg-surface-footer ${PAD}`}>
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <span className="shrink-0 bg-accent px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white">
            Trending
          </span>
          <Ticker items={ticker} />
        </div>
        <nav aria-label="Utility" className="hidden gap-6 text-[11px] uppercase tracking-[0.06em] text-[#b9b9b9] sm:flex">
          <Link href="/about" className="hover:text-white">About</Link>
          <a href="#" className="hover:text-white">Advertise with us</a>
          <a href="#" className="hover:text-white">Contact us</a>
        </nav>
      </div>

      {/* Masthead */}
      <div className={`flex h-[88px] items-center justify-between ${PAD}`}>
        <div className="hidden gap-3 sm:flex">
          {SOCIAL.map(({ name, Icon, href }) => (
            <a
              key={name}
              href={href}
              aria-label={name}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink-700 transition-colors hover:-translate-y-px hover:border-accent hover:bg-accent hover:text-white"
            >
              <Icon size={16} />
            </a>
          ))}
        </div>

        <Link href="/" className="flex items-center" aria-label={title}>
          {/* eslint-disable @next/next/no-img-element */}
          <img src="/brandish-logo.png" alt={title} className="logo-light h-10 w-auto sm:h-14" />
          <img src="/brandish-logo-footer.png" alt="" aria-hidden="true" className="logo-dark h-10 w-auto sm:h-14" />
          {/* eslint-enable @next/next/no-img-element */}
        </Link>

        <a
          href="#newsletter"
          className="whitespace-nowrap rounded-sm bg-accent px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.08em] text-white transition-colors hover:bg-accent-hover sm:px-5"
        >
          Subscribe
        </a>
      </div>

      {/* Primary nav */}
      <div className={`flex h-12 items-center justify-between border-y border-line ${PAD}`}>
        <span className="hidden text-[13px] text-ink-600 md:block">{today}</span>
        <nav aria-label="Sections" className="hidden h-12 items-center gap-7 lg:flex">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`flex h-12 items-center text-[15px] font-medium transition-colors ${
                n.active
                  ? "border-b-2 border-accent text-accent"
                  : "text-ink-900 hover:text-accent"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-900 transition-colors hover:bg-accent hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900"
          >
            <SearchIcon />
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-900 hover:bg-surface-alt lg:hidden"
          >
            <Menu />
          </button>
        </div>
      </div>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} items={search} chips={chips} />
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} nav={nav} />
    </header>
  );
}
