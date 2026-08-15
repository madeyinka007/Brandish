import Link from "next/link";
import { type Category, type Post, categoryHref, formatDate, labelForCategory, postHref } from "@/lib/site";
import { Media, MetaRow, ReadMore, Tag } from "./primitives";

// Editorial card set (Card/Article variants from the design system). All server components.
// Each derives its category label/href, meta date and permalink from the post + loaded categories.

interface CardProps {
  post: Post;
  categories: Category[];
}

const titleLink = "transition-colors hover:text-accent";

/** Variant=Hero — the lead story. Renders the page H1. */
export function HeroCard({ post, categories }: CardProps) {
  const href = postHref(post);
  return (
    <article className="flex flex-col gap-4">
      <Link href={href} className={titleLink}>
        <h1 className="text-pretty font-serif text-[28px] font-bold leading-[1.18] sm:text-[34px]">{post.title}</h1>
      </Link>
      <MetaRow
        label={labelForCategory(post.category, categories)}
        href={categoryHref(post.category)}
        author={post.author?.name}
        date={formatDate(post)}
      />
      <Link href={href} aria-label={post.title}>
        <Media post={post} className="aspect-[16/9]" sizes="(max-width: 1024px) 100vw, 585px" priority badge />
      </Link>
      {post.excerpt ? <p className="line-clamp-3 text-[14px] leading-[1.6] text-ink-500">{post.excerpt}</p> : null}
      <div>
        <ReadMore href={href} />
      </div>
    </article>
  );
}

/** Variant=Feature — a section lead: media + big serif title + meta + excerpt + Read more. */
export function FeatureCard({
  post,
  categories,
  ratio = "aspect-[3/2]",
  titleSize = "text-[22px] sm:text-[26px]",
  readMore = true,
}: CardProps & { ratio?: string; titleSize?: string; readMore?: boolean }) {
  const href = postHref(post);
  return (
    <article className="flex flex-col gap-4">
      <Link href={href} aria-label={post.title}>
        <Media post={post} className={ratio} sizes="(max-width: 768px) 100vw, 420px" badge />
      </Link>
      <Link href={href} className={titleLink}>
        <h3 className={`text-pretty font-serif font-bold leading-[1.22] ${titleSize}`}>{post.title}</h3>
      </Link>
      <MetaRow label={labelForCategory(post.category, categories)} href={categoryHref(post.category)} date={formatDate(post)} />
      {post.excerpt ? <p className="line-clamp-2 text-[14px] leading-[1.6] text-ink-500">{post.excerpt}</p> : null}
      {readMore ? (
        <div>
          <ReadMore href={href} />
        </div>
      ) : null}
    </article>
  );
}

/** Variant=Stacked — media on top, compact serif title, meta, short excerpt. */
export function StackedCard({ post, categories, excerpt = true }: CardProps & { excerpt?: boolean }) {
  const href = postHref(post);
  return (
    <article className="flex flex-col gap-3">
      <Link href={href} aria-label={post.title}>
        <Media post={post} className="aspect-[3/2]" sizes="(max-width: 768px) 50vw, 280px" badge />
      </Link>
      <Link href={href} className={titleLink}>
        <h3 className="min-h-[43px] text-pretty font-serif text-[16px] font-bold leading-[1.35]">{post.title}</h3>
      </Link>
      <MetaRow label={labelForCategory(post.category, categories)} href={categoryHref(post.category)} date={formatDate(post)} />
      {excerpt && post.excerpt ? <p className="line-clamp-2 text-[14px] leading-[1.6] text-ink-500">{post.excerpt}</p> : null}
    </article>
  );
}

/** Variant=ListRow — title (+ excerpt) with a right-hand thumbnail; hairline divider. */
export function ListRow({ post, categories, excerpt = true }: CardProps & { excerpt?: boolean }) {
  const href = postHref(post);
  return (
    <article className="flex items-start gap-6 border-b border-line pb-5">
      <div className="flex flex-1 flex-col gap-2">
        <Link href={href} className={titleLink}>
          <h3 className="text-pretty font-serif text-[18px] font-bold leading-[1.3] sm:text-[20px]">{post.title}</h3>
        </Link>
        {excerpt && post.excerpt ? (
          <p className="line-clamp-2 text-[14px] leading-[1.6] text-ink-500">{post.excerpt}</p>
        ) : (
          <MetaRow label={labelForCategory(post.category, categories)} href={categoryHref(post.category)} date={formatDate(post)} />
        )}
      </div>
      <Link href={href} aria-hidden="true" tabIndex={-1} className="shrink-0">
        <Media post={post} className="h-[114px] w-[130px] sm:w-[165px]" sizes="165px" badge />
      </Link>
    </article>
  );
}

/** Variant=Compact — sidebar row: small serif title + date, optional 62px thumb. */
export function CompactRow({ post, thumb = true }: { post: Post; thumb?: boolean }) {
  const href = postHref(post);
  return (
    <article className="flex items-start gap-4 border-b border-line pb-5">
      <div className="flex flex-1 flex-col gap-1">
        <Link href={href} className={titleLink}>
          <h3 className="font-serif text-[15px] font-semibold leading-[1.4]">{post.title}</h3>
        </Link>
        <span className="text-[12px] text-ink-400">{formatDate(post)}</span>
      </div>
      {thumb ? (
        <Link href={href} aria-hidden="true" tabIndex={-1} className="shrink-0">
          <Media post={post} className="h-[62px] w-[62px]" sizes="62px" />
        </Link>
      ) : null}
    </article>
  );
}

/** MiniHeadline — title + date only, top-divider (mid/opinion lists). */
export function MiniHeadline({ post }: { post: Post }) {
  const href = postHref(post);
  return (
    <article className="flex flex-col gap-1 border-t border-line pt-5">
      <Link href={href} className={titleLink}>
        <h3 className="font-serif text-[15px] font-semibold leading-[1.4]">{post.title}</h3>
      </Link>
      <span className="text-[12px] text-ink-400">{formatDate(post)}</span>
    </article>
  );
}

/** Variant=Ranked — big index numeral beside the title (Editor's Picks / Latest). */
export function RankedRow({ post, rank }: { post: Post; rank: number }) {
  const href = postHref(post);
  return (
    <article className="flex items-start gap-3 border-b border-line pb-5">
      <span className="font-serif text-[28px] font-light leading-none text-ink-300" aria-hidden="true">
        {rank}
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <Link href={href} className={titleLink}>
          <h3 className="font-serif text-[15px] font-semibold leading-[1.4]">{post.title}</h3>
        </Link>
        <span className="text-[12px] text-ink-400">{formatDate(post)}</span>
      </div>
    </article>
  );
}

/** Small trending item used in the utility ticker + the strip below the nav. */
export function TrendingItem({ post, categories }: CardProps) {
  const href = postHref(post);
  return (
    <Link href={href} className="group flex items-start gap-4">
      <span className="flex flex-1 flex-col gap-1.5">
        <Tag label={labelForCategory(post.category, categories)} href={categoryHref(post.category)} />
        <span className="line-clamp-2 font-serif text-[14px] font-semibold leading-[1.35] text-ink-900 transition-colors group-hover:text-accent">
          {post.title}
        </span>
      </span>
      <Media post={post} className="h-[52px] w-[78px] shrink-0" sizes="78px" />
    </Link>
  );
}
