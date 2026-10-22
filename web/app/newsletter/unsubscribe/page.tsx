import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "@/components/public/icons";

// Landing page for the one-click opt-out link in every newsletter email. The API redirects
// here after GET /api/newsletter/unsubscribe.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Unsubscribed — Brandish",
  description: "You have been unsubscribed from the Brandish newsletter.",
};

export default function NewsletterUnsubscribePage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <main className="flex flex-1 items-center justify-center px-5 py-20">
        <div className="w-full max-w-lg border border-line bg-surface p-8 text-center sm:p-10">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface-alt text-ink-600">
            <Mail width={26} height={26} />
          </span>

          <h1 className="mt-6 font-serif text-[28px] font-bold leading-tight text-ink-900">
            You've been unsubscribed
          </h1>

          <p className="mx-auto mt-3 max-w-md text-[15px] leading-[1.7] text-ink-500">
            You won't receive the Brandish newsletter any more. Sorry to see you go — the rest of
            the site stays open, and you can subscribe again at any time.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center gap-2 rounded-sm bg-accent px-6 py-3 text-[13px] font-bold uppercase tracking-[0.08em] text-white transition-colors hover:bg-accent-hover sm:w-auto"
            >
              <Mail width={15} height={15} /> Back to Brandish
            </Link>
            <Link
              href="/#newsletter"
              className="inline-flex w-full items-center justify-center rounded-sm border border-line px-6 py-3 text-[13px] font-bold uppercase tracking-[0.08em] text-ink-600 transition-colors hover:bg-surface-alt sm:w-auto"
            >
              Subscribe again
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
