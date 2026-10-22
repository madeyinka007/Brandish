"use client";

import { useState } from "react";
import { apiFetch, type ApiError } from "@/lib/api";

// Double opt-in newsletter sign-up. Posts to the public /api/newsletter endpoint, which stores
// the address as a `pending` subscriber and emails a confirmation link (see docs/workflows.md).
// Every sign-up lands in the admin Subscribers list — this component is the only place the
// public site collects them, so it is used by the footer and the sidebar widget alike.
//
// `source` tells the admin which form the reader came from (footer vs sidebar); the variant
// implies it, so callers don't have to pass it.
export default function NewsletterForm({
  variant = "dark",
  source,
}: {
  variant?: "dark" | "light";
  source?: string;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const dark = variant === "dark";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setState("error");
      setMessage("Please enter a valid email address.");
      return;
    }
    setState("loading");
    try {
      const result = await apiFetch<{ status?: string; message?: string }>("/api/newsletter", {
        method: "POST",
        body: JSON.stringify({ email, source: source ?? (dark ? "footer" : "sidebar") }),
      });
      setState("done");
      setMessage(
        result?.message ??
          (result?.status === "already_subscribed"
            ? "You're already subscribed to Brandish."
            : "Almost there — check your inbox to confirm your subscription."),
      );
      setEmail("");
    } catch (err) {
      const e2 = err as ApiError;
      setState("error");
      setMessage(
        e2.status === 404
          ? "Newsletter sign-up is launching soon."
          : e2.status === 429
            ? "Too many sign-up attempts. Please try again later."
            : "Couldn't subscribe right now. Please try again.",
      );
    }
  }

  if (state === "done") {
    return (
      <p className={`text-[14px] leading-[1.7] ${dark ? "text-[#d6d6d6]" : "text-ink-600"}`} role="status">
        {message}
      </p>
    );
  }

  // Footer (dark) is wide → input + button share a row. Sidebar (light) is narrow → stack them
  // so the full-width button never overflows the column.
  const fieldCls = dark
    ? "h-12 flex-1 rounded-sm border-0 bg-field-dark px-4 text-[15px] text-[#f5f5f5] placeholder:text-[#a8a8a8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    : "h-10 w-full min-w-0 rounded-sm border border-line bg-surface px-4 text-[14px] text-ink-900 placeholder:text-ink-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2.5">
      <div className={dark ? "flex gap-2" : "flex flex-col gap-2"}>
        <label className="sr-only" htmlFor={`nl-${variant}`}>
          Email address
        </label>
        <input
          id={`nl-${variant}`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email address.."
          autoComplete="email"
          className={fieldCls}
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className={`flex items-center justify-center rounded-sm bg-accent text-[13px] font-bold uppercase tracking-[0.08em] text-white transition-colors hover:bg-accent-hover disabled:opacity-60 ${
            dark ? "px-6" : "w-full py-3"
          }`}
        >
          {state === "loading" ? "…" : "Subscribe"}
        </button>
      </div>
      {state === "error" ? (
        <p className={`text-[13px] ${dark ? "text-[#f5b5bd]" : "text-accent"}`} role="alert">
          {message}
        </p>
      ) : (
        <p className={`text-[13px] leading-[1.6] ${dark ? "text-[#9e9e9e]" : "text-ink-500"}`}>
          By signing up, you agree to our{" "}
          <a href="#privacy" className="underline underline-offset-2">
            Privacy Policy
          </a>
          .
        </p>
      )}
    </form>
  );
}
