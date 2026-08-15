"use client";

import { useState } from "react";
import { apiFetch, type ApiError } from "@/lib/api";

// Public comment submission. Posts to /api/comments; the server strips HTML and stores the
// comment as `pending`, so it appears only after a moderator approves it. reCAPTCHA v3 is used
// when NEXT_PUBLIC_RECAPTCHA_SITE_KEY is set (production); in dev the server skips verification.
const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

declare global {
  interface Window {
    grecaptcha?: { ready: (cb: () => void) => void; execute: (key: string, opts: { action: string }) => Promise<string> };
  }
}

function loadRecaptcha(): Promise<void> {
  if (!SITE_KEY || typeof window === "undefined" || window.grecaptcha) return Promise.resolve();
  return new Promise((resolve) => {
    if (document.getElementById("recaptcha-v3")) return resolve();
    const s = document.createElement("script");
    s.id = "recaptcha-v3";
    s.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.head.appendChild(s);
  });
}

async function getToken(): Promise<string> {
  if (!SITE_KEY) return "";
  await loadRecaptcha();
  const g = window.grecaptcha;
  if (!g) return "";
  return new Promise((resolve) => g.ready(() => g.execute(SITE_KEY!, { action: "comment" }).then(resolve).catch(() => resolve(""))));
}

const inputCls =
  "w-full rounded-sm border border-line bg-surface px-4 py-2.5 text-[14px] text-ink-900 placeholder:text-ink-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default function CommentForm({ postId }: { postId: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || body.trim().length < 2) {
      setState("error");
      setMessage("Please add your name, a valid email, and a comment.");
      return;
    }
    setState("loading");
    setMessage("");
    try {
      const recaptchaToken = await getToken();
      await apiFetch("/api/comments", {
        method: "POST",
        body: JSON.stringify({ postId, authorName: name.trim(), authorEmail: email.trim(), body: body.trim(), recaptchaToken }),
      });
      setState("done");
      setMessage("Thanks! Your comment has been submitted and will appear once it's approved.");
      setName("");
      setEmail("");
      setBody("");
    } catch (err) {
      const e2 = err as ApiError;
      setState("error");
      setMessage(
        e2.status === 429
          ? "You're commenting too quickly — please try again in a little while."
          : e2.status === 400
            ? "Please check your details and try again."
            : "Couldn't post your comment right now. Please try again.",
      );
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-sm border border-line bg-surface-alt p-5 text-[14px] leading-[1.6] text-ink-700" role="status">
        {message}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <h3 className="font-serif text-[20px] font-bold text-ink-900">Leave a Comment</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="sr-only" htmlFor="c-name">Name</label>
          <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" autoComplete="name" className={inputCls} />
        </div>
        <div>
          <label className="sr-only" htmlFor="c-email">Email</label>
          <input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (not published)" autoComplete="email" className={inputCls} />
        </div>
      </div>
      <div>
        <label className="sr-only" htmlFor="c-body">Comment</label>
        <textarea id="c-body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Share your thoughts…" className={`${inputCls} resize-y`} />
      </div>
      {state === "error" ? (
        <p className="text-[13px] text-accent" role="alert">{message}</p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-[420px] text-[12px] leading-[1.5] text-ink-400">
          Your email is never published. Comments are moderated and appear after approval.
        </p>
        <button
          type="submit"
          disabled={state === "loading"}
          className="rounded-sm bg-accent px-6 py-3 text-[13px] font-bold uppercase tracking-[0.08em] text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {state === "loading" ? "Posting…" : "Post Comment"}
        </button>
      </div>
      {SITE_KEY ? <p className="text-[11px] text-ink-400">This site is protected by reCAPTCHA.</p> : null}
    </form>
  );
}
