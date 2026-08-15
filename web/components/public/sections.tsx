import Link from "next/link";
import { type Category, type Post, categoryHref, formatDate, labelForCategory, postHref } from "@/lib/site";
import {
  CompactRow,
  FeatureCard,
  HeroCard,
  ListRow,
  MiniHeadline,
  StackedCard,
  TrendingItem,
} from "./cards";
import { Media, MetaRow, ReadMore, SectionLabel } from "./primitives";
import AdSlot from "./AdSlot";

const PAD = "px-4 sm:px-8 lg:px-16 xl:px-[120px]";
const RULE = "lg:border-l lg:border-line lg:pl-[30px]";
const titleLink = "transition-colors hover:text-accent";
const FEATURE_COLS = "grid grid-cols-1 items-start gap-[30px] lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]";

interface WithCats {
  categories: Category[];
}

/** Four trending items across a tinted strip below the nav. */
export function TrendingStrip({ posts, categories }: { posts: Post[] } & WithCats) {
  if (posts.length === 0) return null;
  return (
    <div className="bg-surface-alt">
      <div className={`${PAD} py-5`}>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {posts.map((p) => (
            <TrendingItem key={p._id} post={p} categories={categories} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Hero band — 6 / 3 / 3 (lead + rows · secondary + opinion · just-in + stacked). */
export function HeroBand({
  lead,
  heroRows,
  secondary,
  midRows,
  opinion,
  justIn,
  stacked,
  categories,
}: {
  lead: Post | null;
  heroRows: Post[];
  secondary: Post | null;
  midRows: Post[];
  opinion: Post[];
  justIn: Post[];
  stacked: Post[];
} & WithCats) {
  if (!lead) return null;
  return (
    <section className={`${PAD} pt-10 sm:pt-16`} aria-label="Top stories">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-[30px]">
        {/* Col 1 — lead + list */}
        <div className="flex flex-col gap-10 lg:col-span-6">
          <HeroCard post={lead} categories={categories} />
          {heroRows.length > 0 ? (
            <div className="flex flex-col gap-5">
              {heroRows.map((p) => (
                <ListRow key={p._id} post={p} categories={categories} />
              ))}
            </div>
          ) : null}
        </div>

        {/* Col 2 — secondary feature + opinion */}
        <div className={`flex flex-col gap-10 lg:col-span-3 ${RULE}`}>
          {secondary ? (
            <div className="flex flex-col gap-5">
              <FeatureCard post={secondary} categories={categories} ratio="aspect-[4/3]" titleSize="text-[20px]" readMore={false} />
              {midRows.length > 0 ? (
                <div className="flex flex-col gap-5">
                  {midRows.map((p) => (
                    <MiniHeadline key={p._id} post={p} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {opinion.length > 0 ? (
            <div className="flex flex-col gap-5">
              <SectionLabel>Opinion</SectionLabel>
              {opinion.map((p, i) =>
                i === 0 ? (
                  <FeatureCard key={p._id} post={p} categories={categories} ratio="aspect-[16/9]" titleSize="text-[20px]" readMore={false} />
                ) : (
                  <MiniHeadline key={p._id} post={p} />
                ),
              )}
            </div>
          ) : null}
        </div>

        {/* Col 3 — just in + stacked */}
        <div className={`flex flex-col gap-10 lg:col-span-3 ${RULE}`}>
          <div className="flex flex-col gap-5">
            <SectionLabel>Just In</SectionLabel>
            {justIn.map((p) => (
              <CompactRow key={p._id} post={p} />
            ))}
          </div>
          {stacked.length > 0 ? (
            <div className="flex flex-col gap-6">
              {stacked.map((p) => (
                <StackedCard key={p._id} post={p} categories={categories} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** Text-left / media-right feature used as a band lead. */
function FeatureSplit({ post, categories }: { post: Post } & WithCats) {
  const href = postHref(post);
  return (
    <div className="flex flex-col gap-[30px] sm:flex-row sm:items-start">
      <div className="flex flex-col gap-4 sm:max-w-[420px] sm:flex-1">
        <Link href={href} className="transition-colors hover:text-accent">
          <h3 className="text-pretty font-serif text-[22px] font-bold leading-[1.22] sm:text-[26px]">{post.title}</h3>
        </Link>
        <MetaRow label={labelForCategory(post.category, categories)} href={categoryHref(post.category)} date={formatDate(post)} />
        {post.excerpt ? <p className="line-clamp-3 text-[14px] leading-[1.6] text-ink-500">{post.excerpt}</p> : null}
        <div>
          <ReadMore href={href} />
        </div>
      </div>
      <Link href={href} aria-hidden="true" tabIndex={-1} className="w-full sm:flex-1">
        <Media post={post} className="aspect-[3/2]" sizes="(max-width: 768px) 100vw, 460px" badge />
      </Link>
    </div>
  );
}

/** Image-top feature (media · title · meta · excerpt · Read more) used inside the section bands. */
function FeatureVertical({ post, categories }: { post: Post } & WithCats) {
  const href = postHref(post);
  return (
    <article className="flex flex-col gap-4">
      <Link href={href} aria-label={post.title}>
        <Media post={post} className="aspect-[3/2]" sizes="(max-width: 768px) 100vw, 420px" badge />
      </Link>
      <Link href={href} className={titleLink}>
        <h3 className="text-pretty font-serif text-[22px] font-bold leading-[1.22] sm:text-[26px]">{post.title}</h3>
      </Link>
      <MetaRow label={labelForCategory(post.category, categories)} href={categoryHref(post.category)} date={formatDate(post)} />
      {post.excerpt ? <p className="line-clamp-3 text-[14px] leading-[1.6] text-ink-500">{post.excerpt}</p> : null}
      <div>
        <ReadMore href={href} />
      </div>
    </article>
  );
}

/** Small image-top card — title + date only (Money cluster). */
function MiniCard({ post }: { post: Post }) {
  const href = postHref(post);
  return (
    <article className="flex flex-col gap-3">
      <Link href={href} aria-label={post.title}>
        <Media post={post} className="aspect-[3/2]" sizes="200px" />
      </Link>
      <Link href={href} className={titleLink}>
        <h3 className="min-h-[43px] text-pretty font-serif text-[16px] font-bold leading-[1.35]">{post.title}</h3>
      </Link>
      <span className="text-[12px] text-ink-400">{formatDate(post)}</span>
    </article>
  );
}

/** Row with a 62px thumbnail on the LEFT (Money cluster), top divider. */
function RowLeftThumb({ post }: { post: Post }) {
  const href = postHref(post);
  return (
    <article className="flex items-start gap-4 border-t border-line pt-5">
      <Link href={href} aria-hidden="true" tabIndex={-1} className="shrink-0">
        <Media post={post} className="h-[62px] w-[62px]" sizes="62px" />
      </Link>
      <div className="flex flex-1 flex-col gap-1">
        <Link href={href} className={titleLink}>
          <h3 className="font-serif text-[15px] font-semibold leading-[1.4]">{post.title}</h3>
        </Link>
        <span className="text-[12px] text-ink-400">{formatDate(post)}</span>
      </div>
    </article>
  );
}

/** Row with a wide thumbnail on the RIGHT (Tech stream), bottom divider. */
function TechRow({ post }: { post: Post }) {
  const href = postHref(post);
  return (
    <article className="flex items-start gap-6 border-b border-line pb-5">
      <div className="flex flex-1 flex-col gap-1">
        <Link href={href} className={titleLink}>
          <h3 className="text-pretty font-serif text-[16px] font-bold leading-[1.35]">{post.title}</h3>
        </Link>
        <span className="text-[12px] text-ink-400">{formatDate(post)}</span>
      </div>
      <Link href={href} aria-hidden="true" tabIndex={-1} className="shrink-0">
        <Media post={post} className="h-[73px] w-[100px] sm:w-[110px]" sizes="110px" badge />
      </Link>
    </article>
  );
}

/**
 * Pattern A — full-width labelled 9 / 3 band: a text-left / media-right feature over a three-up
 * of headlines, beside an (unlabelled) compact sidebar list. (The design's "Corporate Brands".)
 */
export function FeatureBand({
  label,
  href,
  feature,
  sub,
  side,
  categories,
}: {
  label: string;
  href?: string;
  feature: Post;
  sub: Post[];
  side: Post[];
} & WithCats) {
  return (
    <section className={`${PAD} pt-10 sm:pt-16`} aria-label={label}>
      <div className="flex flex-col gap-6">
        <SectionLabel href={href}>{label}</SectionLabel>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-[30px]">
          <div className="flex flex-col gap-10 lg:col-span-9">
            <FeatureSplit post={feature} categories={categories} />
            {sub.length > 0 ? (
              <div className="grid grid-cols-1 gap-[30px] border-t border-line pt-6 sm:grid-cols-3">
                {sub.map((p) => (
                  <div key={p._id} className="flex flex-col gap-2">
                    <Link href={postHref(p)} className={titleLink}>
                      <h3 className="min-h-[43px] text-pretty font-serif text-[16px] font-bold leading-[1.35]">{p.title}</h3>
                    </Link>
                    <span className="text-[12px] text-ink-400">{formatDate(p)}</span>
                    {p.excerpt ? <p className="line-clamp-2 text-[14px] leading-[1.6] text-ink-500">{p.excerpt}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div className={`flex flex-col gap-5 lg:col-span-3 ${RULE}`}>
            {side.map((p) => (
              <CompactRow key={p._id} post={p} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Pattern B — two labelled sub-sections (a Money-style cluster + a Tech-style stream) stacked in
 * a 9-column stream with an in-band ad between them, beside a labelled Editor's Picks sidebar.
 */
export function MoneyTechBand({
  primaryLabel,
  primaryHref,
  primary,
  secondaryLabel,
  secondaryHref,
  secondary,
  picks,
  categories,
}: {
  primaryLabel: string;
  primaryHref?: string;
  primary: Post[];
  secondaryLabel: string;
  secondaryHref?: string;
  secondary: Post[];
  picks: Post[];
} & WithCats) {
  if (primary.length === 0) return null;
  const [pLead, pCard1, pCard2, pRow1, pRow2] = primary;
  const [sLead, ...sRows] = secondary;

  return (
    <section className={`${PAD} pt-10 sm:pt-16`} aria-label={primaryLabel}>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-[30px]">
        {/* 9-col stream */}
        <div className="flex flex-col gap-14 lg:col-span-9">
          {/* Money-style cluster */}
          <div className="flex flex-col gap-6">
            <SectionLabel href={primaryHref}>{primaryLabel}</SectionLabel>
            <div className={FEATURE_COLS}>
              <FeatureVertical post={pLead} categories={categories} />
              <div className="flex flex-col gap-6">
                {(pCard1 || pCard2) && (
                  <div className="grid grid-cols-2 gap-[30px]">
                    {pCard1 ? <MiniCard post={pCard1} /> : null}
                    {pCard2 ? <MiniCard post={pCard2} /> : null}
                  </div>
                )}
                {(pRow1 || pRow2) && (
                  <div className="flex flex-col gap-5">
                    {pRow1 ? <RowLeftThumb post={pRow1} /> : null}
                    {pRow2 ? <RowLeftThumb post={pRow2} /> : null}
                  </div>
                )}
              </div>
            </div>
            <div className="pt-2">
              <AdSlot size="banner" />
            </div>
          </div>

          {/* Tech-style stream */}
          {sLead ? (
            <div className="flex flex-col gap-6">
              <SectionLabel href={secondaryHref}>{secondaryLabel}</SectionLabel>
              <div className={FEATURE_COLS}>
                <FeatureVertical post={sLead} categories={categories} />
                <div className="flex flex-col gap-5">
                  {sRows.slice(0, 4).map((p) => (
                    <TechRow key={p._id} post={p} />
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* 3-col Editor's Picks */}
        <div className={`flex flex-col gap-5 lg:col-span-3 ${RULE}`}>
          <EditorsPicks posts={picks} categories={categories} />
        </div>
      </div>
    </section>
  );
}

/** Sidebar widget — a lead card over a compact list with right-hand thumbnails. */
export function EditorsPicks({ posts, categories }: { posts: Post[] } & WithCats) {
  if (posts.length === 0) return null;
  const [lead, ...rest] = posts;
  return (
    <>
      <SectionLabel>Editor’s Picks</SectionLabel>
      <StackedCard post={lead} categories={categories} />
      {rest.map((p) => (
        <CompactRow key={p._id} post={p} />
      ))}
    </>
  );
}

/** Bottom category quad — 4 columns, each a category lead + a few headlines. */
export function CategoryQuad({
  columns,
  categories,
}: {
  columns: { slug: string; label: string; posts: Post[] }[];
} & WithCats) {
  if (columns.length === 0) return null;
  return (
    <section className={`${PAD} py-10 sm:py-16`} aria-label="More from Brandish">
      <div className="grid grid-cols-1 gap-[30px] sm:grid-cols-2 xl:grid-cols-4">
        {columns.map((col) => (
          <div key={col.slug} className="flex flex-col gap-5">
            <SectionLabel href={categoryHref(col.slug)}>{col.label}</SectionLabel>
            {col.posts[0] ? <StackedCard post={col.posts[0]} categories={categories} /> : null}
            {col.posts.slice(1, 4).map((p) => (
              <MiniHeadline key={p._id} post={p} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
