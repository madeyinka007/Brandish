import Link from "next/link";
import { type Post, type RecentComment, formatDate, postHref } from "@/lib/site";
import { Media, SectionLabel } from "./primitives";
import { Mail, MessageCircle } from "./icons";
import NewsletterForm from "./NewsletterForm";

// Reusable sidebar widgets shared by the category listing and the post detail pages.
const titleLink = "transition-colors hover:text-accent";

/** Compact row with a left 80×56 thumb (Editors Picks). */
function PickRow({ post }: { post: Post }) {
  const href = postHref(post);
  return (
    <article className="flex items-start gap-4 border-b border-line pb-5">
      <Link href={href} aria-hidden="true" tabIndex={-1} className="shrink-0">
        <Media post={post} className="h-[56px] w-[80px]" sizes="80px" />
      </Link>
      <div className="flex flex-1 flex-col gap-1">
        <Link href={href} className={titleLink}>
          <h3 className="text-pretty font-serif text-[15px] font-semibold leading-[1.4]">{post.title}</h3>
        </Link>
        <span className="text-[12px] text-ink-400">{formatDate(post)}</span>
      </div>
    </article>
  );
}

/** Ranked item: 16:9 media + big numeral + title/date. */
function RankedItem({ post, rank }: { post: Post; rank: number }) {
  const href = postHref(post);
  return (
    <article className="flex flex-col gap-3 border-b border-line pb-5">
      <Link href={href} aria-hidden="true" tabIndex={-1}>
        <Media post={post} className="aspect-[16/9]" sizes="285px" badge />
      </Link>
      <div className="flex items-start gap-3">
        <span className="font-serif text-[28px] font-light leading-none text-ink-300" aria-hidden="true">
          {rank}
        </span>
        <div className="flex flex-col gap-1">
          <Link href={href} className={titleLink}>
            <h3 className="text-pretty font-serif text-[16px] font-bold leading-[1.35]">{post.title}</h3>
          </Link>
          <span className="text-[12px] text-ink-400">{formatDate(post)}</span>
        </div>
      </div>
    </article>
  );
}

export function EditorsPicksWidget({ posts }: { posts: Post[] }) {
  if (posts.length === 0) return null;
  return (
    <div className="flex flex-col gap-5">
      <SectionLabel>Editors Picks</SectionLabel>
      {posts.map((p) => (
        <PickRow key={p._id} post={p} />
      ))}
    </div>
  );
}

export function LatestPostsWidget({ posts }: { posts: Post[] }) {
  if (posts.length === 0) return null;
  return (
    <div className="flex flex-col gap-5">
      <SectionLabel>Latest Posts</SectionLabel>
      {posts.map((p, i) => (
        <RankedItem key={p._id} post={p} rank={i + 1} />
      ))}
    </div>
  );
}

/** One approved comment: author, snippet, and a link to the post it lives on. */
function RecentCommentRow({ comment }: { comment: RecentComment }) {
  const href = comment.post ? postHref({ category: comment.post.category, slug: comment.post.slug } as Post) : null;
  return (
    <article className="flex items-start gap-3 border-b border-line pb-5">
      <MessageCircle size={16} className="mt-0.5 shrink-0 text-accent" />
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-baseline gap-2 text-[13px]">
          <span className="font-semibold text-ink-900">{comment.authorName}</span>
          <span className="text-[12px] text-ink-400">{formatDate({ publishedAt: comment.createdAt, createdAt: comment.createdAt } as Post)}</span>
        </div>
        <p className="line-clamp-2 text-[13px] leading-[1.55] text-ink-700">{comment.body}</p>
        {comment.post ? (
          href ? (
            <Link href={href} className="line-clamp-1 text-[12px] text-ink-400 transition-colors hover:text-accent">
              on <span className="italic">{comment.post.title}</span>
            </Link>
          ) : (
            <span className="line-clamp-1 text-[12px] text-ink-400">on <span className="italic">{comment.post.title}</span></span>
          )
        ) : null}
      </div>
    </article>
  );
}

export function RecentCommentsWidget({ comments }: { comments: RecentComment[] }) {
  if (comments.length === 0) return null;
  return (
    <div className="flex flex-col gap-5">
      <SectionLabel>Recent Comments</SectionLabel>
      {comments.map((c) => (
        <RecentCommentRow key={c._id} comment={c} />
      ))}
    </div>
  );
}

export function NewsletterWidget() {
  return (
    <div className="flex flex-col items-center gap-3.5 border border-line bg-surface-alt p-6 text-center">
      <Mail size={24} className="text-ink-900" />
      <h3 className="font-serif text-[20px] font-bold text-ink-900">Subscribe to News</h3>
      <p className="text-[13px] leading-[1.6] text-ink-500">
        Get the latest reporting from Brandish on money, energy, FMCG and the brands shaping them.
      </p>
      <div className="w-full text-left">
        <NewsletterForm variant="light" />
      </div>
    </div>
  );
}

export function MpuAd() {
  return (
    <div className="flex flex-col items-center gap-2 lg:sticky lg:top-6">
      <span className="text-[11px] uppercase tracking-[0.06em] text-ink-400">Advertisement</span>
      <div className="hatch flex h-[466px] w-full items-center justify-center text-[11px] uppercase tracking-[0.06em] text-ink-400">
        Ad space · 300×600
      </div>
    </div>
  );
}
