import Link from "next/link";
import {
  type Category,
  type CategoryPageData,
  type Post,
  categoryHref,
  formatDate,
  labelForCategory,
  postHref,
} from "@/lib/site";
import { Media, MetaRow, ReadMore } from "./primitives";
import { ChevronLeft, ChevronRight } from "./icons";
import { EditorsPicksWidget, LatestPostsWidget, MpuAd, NewsletterWidget, RecentCommentsWidget } from "./widgets";

const titleLink = "transition-colors hover:text-accent";

interface Cats {
  categories: Category[];
}

/* ------------------------------- stream cards ------------------------------- */

/** Lead: text-left / media-right, 16:9. */
function Feature({ post, categories }: { post: Post } & Cats) {
  const href = postHref(post);
  return (
    <article className="flex flex-col gap-[30px] sm:flex-row sm:items-start">
      <div className="flex flex-1 flex-col gap-3">
        <Link href={href} className={titleLink}>
          <h2 className="text-pretty font-serif text-[24px] font-bold leading-[1.2] sm:text-[28px]">{post.title}</h2>
        </Link>
        <MetaRow label={labelForCategory(post.category, categories)} href={categoryHref(post.category)} date={formatDate(post)} />
        {post.excerpt ? <p className="line-clamp-3 text-[14px] leading-[1.6] text-ink-500">{post.excerpt}</p> : null}
        <div className="pt-1">
          <ReadMore href={href} />
        </div>
      </div>
      <Link href={href} aria-hidden="true" tabIndex={-1} className="w-full sm:w-[420px] sm:shrink-0 lg:w-[475px]">
        <Media post={post} className="aspect-[16/9]" sizes="(max-width: 640px) 100vw, 475px" badge />
      </Link>
    </article>
  );
}

/** Two-up: title + meta + right thumb, excerpt under. */
function TwoUpCard({ post, categories }: { post: Post } & Cats) {
  const href = postHref(post);
  return (
    <article className="flex flex-col gap-3">
      <div className="flex items-start gap-6">
        <div className="flex flex-1 flex-col gap-2">
          <Link href={href} className={titleLink}>
            <h3 className="min-h-[45px] text-pretty font-serif text-[17px] font-bold leading-[1.32]">{post.title}</h3>
          </Link>
          <MetaRow label={labelForCategory(post.category, categories)} href={categoryHref(post.category)} date={formatDate(post)} />
        </div>
        <Link href={href} aria-hidden="true" tabIndex={-1} className="shrink-0">
          <Media post={post} className="h-[85px] w-[110px] sm:w-[127px]" sizes="127px" badge />
        </Link>
      </div>
      {post.excerpt ? <p className="line-clamp-2 text-[14px] leading-[1.6] text-ink-500">{post.excerpt}</p> : null}
    </article>
  );
}

/** List row: media-left (260×179) + title/meta/excerpt. */
function ListRowLeft({ post, categories }: { post: Post } & Cats) {
  const href = postHref(post);
  return (
    <article className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:gap-6">
      <Link href={href} aria-hidden="true" tabIndex={-1} className="w-full sm:w-[220px] sm:shrink-0 lg:w-[260px]">
        <Media post={post} className="aspect-[16/11]" sizes="(max-width: 640px) 100vw, 260px" badge />
      </Link>
      <div className="flex flex-1 flex-col gap-2.5">
        <Link href={href} className={titleLink}>
          <h3 className="text-pretty font-serif text-[18px] font-bold leading-[1.3] sm:text-[20px]">{post.title}</h3>
        </Link>
        <MetaRow label={labelForCategory(post.category, categories)} href={categoryHref(post.category)} date={formatDate(post)} />
        {post.excerpt ? <p className="line-clamp-2 text-[14px] leading-[1.6] text-ink-500">{post.excerpt}</p> : null}
      </div>
    </article>
  );
}

/* ------------------------------- pagination -------------------------------- */

function pageHref(base: string, n: number): string {
  return n <= 1 ? base : `${base}?page=${n}`;
}

function Pagination({ page, totalPages, base }: { page: number; totalPages: number; base: string }) {
  if (totalPages <= 1) return null;
  const cell =
    "flex h-10 w-10 items-center justify-center rounded-sm border text-[14px] font-semibold transition-colors";
  const nums: number[] = [];
  const start = Math.max(1, Math.min(page - 1, totalPages - 2));
  for (let n = start; n < start + 3 && n <= totalPages; n++) nums.push(n);

  return (
    <nav aria-label="Pagination" className="flex items-center gap-2 pt-2">
      {page > 1 ? (
        <Link href={pageHref(base, page - 1)} aria-label="Previous page" className={`${cell} border-line text-ink-700 hover:border-ink-900`}>
          <ChevronLeft size={16} />
        </Link>
      ) : null}
      {start > 1 ? (
        <>
          <Link href={pageHref(base, 1)} className={`${cell} border-line text-ink-900 hover:border-ink-900`}>
            1
          </Link>
          <span className="flex h-10 w-6 items-center justify-center text-[14px] text-ink-400">…</span>
        </>
      ) : null}
      {nums.map((n) =>
        n === page ? (
          <span key={n} aria-current="page" className={`${cell} border-accent bg-accent text-white`}>
            {n}
          </span>
        ) : (
          <Link key={n} href={pageHref(base, n)} className={`${cell} border-line text-ink-900 hover:border-ink-900`}>
            {n}
          </Link>
        ),
      )}
      {start + 3 <= totalPages ? (
        <span className="flex h-10 w-6 items-center justify-center text-[14px] text-ink-400">…</span>
      ) : null}
      {page < totalPages ? (
        <Link href={pageHref(base, page + 1)} aria-label="Next page" className={`${cell} border-line text-ink-900 hover:border-ink-900`}>
          <ChevronRight size={16} />
        </Link>
      ) : null}
    </nav>
  );
}

/* -------------------------------- sidebar ---------------------------------- */

/** Compact row with a right-hand 62px thumb. */
function SideRow({ post }: { post: Post }) {
  const href = postHref(post);
  return (
    <article className="flex items-start gap-4 border-b border-line pb-5">
      <div className="flex flex-1 flex-col gap-1">
        <Link href={href} className={titleLink}>
          <h3 className="text-pretty font-serif text-[15px] font-semibold leading-[1.4]">{post.title}</h3>
        </Link>
        <span className="text-[12px] text-ink-400">{formatDate(post)}</span>
      </div>
      <Link href={href} aria-hidden="true" tabIndex={-1} className="shrink-0">
        <Media post={post} className="h-[62px] w-[62px]" sizes="62px" />
      </Link>
    </article>
  );
}

/* ------------------------------- the listing ------------------------------- */

export default function CategoryListing({ data, base }: { data: CategoryPageData; base: string }) {
  const { categories, feature, twoUp, rows, featured, sideTop, picks, latest, recentComments, page, totalPages } = data;

  return (
    <div className="px-4 pb-20 pt-8 sm:px-8 lg:px-16 xl:px-[120px]">
      <div className="flex flex-col gap-8 lg:flex-row lg:gap-[30px]">
        {/* Stream */}
        <div className="flex min-w-0 flex-1 flex-col gap-8">
          {feature ? <Feature post={feature} categories={categories} /> : null}

          {twoUp.length > 0 ? (
            <div className="grid grid-cols-1 gap-[30px] pt-2 sm:grid-cols-2">
              {twoUp.map((p) => (
                <TwoUpCard key={p._id} post={p} categories={categories} />
              ))}
            </div>
          ) : null}

          {rows.length > 0 ? (
            <div className="flex flex-col gap-6 pt-2">
              <span className="h-px bg-line" aria-hidden="true" />
              {rows.map((p) => (
                <ListRowLeft key={p._id} post={p} categories={categories} />
              ))}
            </div>
          ) : null}

          {feature ? null : (
            <p className="py-16 text-center text-ink-400">No stories published in this section yet.</p>
          )}

          <Pagination page={page} totalPages={totalPages} base={base} />
        </div>

        {/* Sidebar */}
        <aside className="flex w-full flex-col gap-10 lg:w-[285px] lg:shrink-0 lg:border-l lg:border-line lg:pl-[30px]">
          {featured ? (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3 border-b border-line pb-5">
                <Link href={postHref(featured)} aria-hidden="true" tabIndex={-1}>
                  <Media post={featured} className="aspect-[16/9]" sizes="285px" badge />
                </Link>
                <Link href={postHref(featured)} className={titleLink}>
                  <h3 className="text-pretty font-serif text-[17px] font-bold leading-[1.32]">{featured.title}</h3>
                </Link>
                <MetaRow label={labelForCategory(featured.category, categories)} href={categoryHref(featured.category)} date={formatDate(featured)} />
              </div>
              {sideTop.map((p) => (
                <SideRow key={p._id} post={p} />
              ))}
            </div>
          ) : null}

          <EditorsPicksWidget posts={picks} />
          <RecentCommentsWidget comments={recentComments} />
          <LatestPostsWidget posts={latest} />
          <NewsletterWidget />
          <MpuAd />
        </aside>
      </div>
    </div>
  );
}
