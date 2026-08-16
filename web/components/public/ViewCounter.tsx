"use client";

import { useEffect, useRef } from "react";
import { API_URL } from "@/lib/api";

/**
 * Fires a single fire-and-forget POST /api/views/:id when a post page loads, so the API can
 * append a page_views event and increment the deduped viewCount (the write side of analytics).
 * Renders nothing. `document.referrer` is sent as the real traffic source (the API falls back
 * to the Referer header otherwise). Failures are ignored — tracking must never affect reading.
 */
export default function ViewCounter({ postId }: { postId: string }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current || !postId) return;
    fired.current = true; // guard against React StrictMode's double-invoke in dev
    fetch(`${API_URL}/api/views/${encodeURIComponent(postId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referrer: typeof document !== "undefined" ? document.referrer || null : null }),
      keepalive: true,
    }).catch(() => {
      /* ignore — best-effort */
    });
  }, [postId]);

  return null;
}
