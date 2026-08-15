"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "./icons";

// Reads the theme the no-FOUC script already applied to <html>, and toggles it (persisting to
// the shared `brandish-theme` key). The CSS variable overrides in globals.css do the recolouring.
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("brandish-theme", next);
    } catch {
      /* ignore */
    }
    setDark(!dark);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title="Toggle dark mode"
      className="flex h-11 w-11 items-center justify-center rounded-full text-ink-900 transition-colors hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900"
    >
      {dark ? <Sun /> : <Moon />}
    </button>
  );
}
