import type { Metadata } from "next";
import Link from "next/link";
import { Close, Mail } from "@/components/public/icons";
import { CheckCircle } from "@/components/admin/icons";

// Landing page for the double opt-in link (see docs/workflows.md). The API redirects here
// after GET /api/newsletter/confirm with `?status=confirmed` or `?status=invalid`.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Newsletter — Brandish",
  description: "Confirm your Brandish newsletter subscription.",
};

export default async function NewsletterConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const confirmed = status === "confirmed";

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <main className="flex flex-1 items-center justify-center px-5 py-20">
        <div className="w-full max-w-lg border border-line bg-surface p-8 text-center sm:p-10">
          <span
            className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
              confirmed ? "bg-emerald-50 text-emerald-600" : "bg-accent-wash text-accent"
            }`}
          >
            {confirmed ? <CheckCircle width={26} height={26} /> : <Close width={26} height={26} />}
          </span>

          <h1 className="mt-6 font-serif text-[28px] font-bold leading-tight text-ink-900">
            {confirmed ? "You're subscribed" : "That link isn't valid"}
          </h1>

          <p className="mx-auto mt-3 max-w-md text-[15px] leading-[1.7] text-ink-500">
            {confirmed
              ? "Thanks for subscribing to Brandish. Our reporting on money, energy, FMCG and the brands shaping them will land in your inbox from now on."
              : "This confirmation link has already been used, or it has expired. Head back to the site and subscribe again — we'll send a fresh confirmation email."}
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center gap-2 rounded-sm bg-accent px-6 py-3 text-[13px] font-bold uppercase tracking-[0.08em] text-white transition-colors hover:bg-accent-hover sm:w-auto"
            >
              <Mail width={15} height={15} /> Back to Brandish
            </Link>
            {!confirmed && (
              <Link
                href="/#newsletter"
                className="inline-flex w-full items-center justify-center rounded-sm border border-line px-6 py-3 text-[13px] font-bold uppercase tracking-[0.08em] text-ink-600 transition-colors hover:bg-surface-alt sm:w-auto"
              >
                Subscribe again
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
