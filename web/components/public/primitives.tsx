import Image from "next/image";
import Link from "next/link";
import type { Post } from "@/lib/site";
import { Play } from "./icons";

// Shared, presentational building blocks for the editorial cards. Server components.

/** Post media: real coverImage via next/image, else the design's hatch placeholder. The parent
 *  sets the box size (an `aspect-*` class or fixed width/height); Media fills it. */
export function Media({
  post,
  className = "",
  sizes,
  priority = false,
  badge = false,
}: {
  post?: Pick<Post, "coverImage" | "title" | "format">;
  className?: string;
  sizes?: string;
  priority?: boolean;
  badge?: boolean;
}) {
  const src = post?.coverImage?.trim();
  const showBadge = badge && post?.format === "video";
  return (
    <div className={`relative overflow-hidden hatch ${className}`}>
      {src ? (
        <Image src={src} alt={post?.title ?? ""} fill sizes={sizes ?? "100vw"} className="object-cover" priority={priority} />
      ) : null}
      {showBadge ? (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white/90 text-ink-900">
            <Play size={14} />
          </span>
        </span>
      ) : null}
    </div>
  );
}

/** Category tag — the only accent-coloured text on the page. */
export function Tag({ label, href, className = "" }: { label: string; href: string; className?: string }) {
  return (
    <Link
      href={href}
      className={`text-[11px] font-bold uppercase tracking-[0.08em] text-accent transition-colors hover:text-accent-hover ${className}`}
    >
      {label}
    </Link>
  );
}

function Sep() {
  return (
    <span className="text-ink-300" aria-hidden="true">
      —
    </span>
  );
}

/** Meta line: TAG — Date — By Author (author optional). */
export function MetaRow({
  label,
  href,
  date,
  author,
}: {
  label?: string;
  href?: string;
  date: string;
  author?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-400">
      {label && href ? (
        <>
          <Tag label={label} href={href} />
          <Sep />
        </>
      ) : null}
      {author ? (
        <>
          <span>By {author}</span>
          <Sep />
        </>
      ) : null}
      <span>{date}</span>
    </div>
  );
}

/** Section spine: uppercase label above a rule. `weight="sub"` = thin hairline rule. */
export function SectionLabel({
  children,
  href,
  weight = "primary",
}: {
  children: React.ReactNode;
  href?: string;
  weight?: "primary" | "sub";
}) {
  const label = (
    <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-ink-900">{children}</h2>
  );
  return (
    <div className="flex flex-col gap-2">
      {href ? (
        <Link href={href} className="transition-colors hover:text-accent">
          {label}
        </Link>
      ) : (
        label
      )}
      <span className={weight === "primary" ? "h-0.5 bg-ink-900" : "h-px bg-line"} aria-hidden="true" />
    </div>
  );
}

/** Secondary "Read more" button — the editorial workhorse, one per card. */
export function ReadMore({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-sm border border-line-strong px-[19px] py-[11px] text-[12px] font-bold uppercase tracking-[0.08em] text-ink-900 transition-colors hover:border-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900"
    >
      Read more
    </Link>
  );
}
