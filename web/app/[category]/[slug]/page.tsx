import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  buildHeaderData,
  bodyToText,
  categoryHref,
  formatDate,
  getPostPageData,
  labelForCategory,
  postHref,
  readingMinutes,
  type Post,
} from "@/lib/site";
import SiteHeader from "@/components/public/SiteHeader";
import SiteFooter from "@/components/public/SiteFooter";
import AdSlot from "@/components/public/AdSlot";
import PostBody from "@/components/public/PostBody";
import ShareRail from "@/components/public/ShareRail";
import ViewCounter from "@/components/public/ViewCounter";
import VideoEmbed from "@/components/public/VideoEmbed";
import CommentForm from "@/components/public/CommentForm";
import { Media } from "@/components/public/primitives";
import { EditorsPicksWidget, LatestPostsWidget, MpuAd, NewsletterWidget } from "@/components/public/widgets";
import { Clock, Facebook, Home as HomeIcon, Instagram, MessageCircle, Pinterest, XMark } from "@/components/public/icons";

export const revalidate = 300;

const PAD = "px-5 tab:px-8 lap:px-10 wide:px-[120px]";
type Params = { params: Promise<{ category: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPostPageData(slug);
  const post = data.post;
  if (!post) return { title: "Story not found" };
  const site = data.settings?.site.title || "Brandish";
  const description = (post.excerpt || bodyToText(post.body)).slice(0, 200);
  const image = post.ogImage || post.coverImage || undefined;
  return {
    title: post.title,
    description,
    alternates: { canonical: postHref(post) },
    openGraph: {
      title: post.title,
      description,
      type: "article",
      siteName: site,
      publishedTime: post.publishedAt ?? undefined,
      authors: post.author?.name ? [post.author.name] : undefined,
      images: image ? [image] : undefined,
    },
    twitter: { card: "summary_large_image", title: post.title, description, images: image ? [image] : undefined },
  };
}

function AuthorAvatar({ src, name, size }: { src?: string; name: string; size: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return <span className="hatch shrink-0 rounded-full" style={{ width: size, height: size }} aria-hidden="true" />;
}

function KeepReadingCard({ post }: { post: Post }) {
  const href = postHref(post);
  return (
    <Link href={href} className="group flex flex-col gap-3">
      <Media post={post} className="aspect-[16/9]" sizes="(max-width: 640px) 100vw, 280px" badge />
      <h3 className="min-h-[43px] text-pretty font-serif text-[16px] font-bold leading-[1.35] transition-colors group-hover:text-accent">
        {post.title}
      </h3>
    </Link>
  );
}

export default async function PostPage({ params }: Params) {
  const { category: categoryParam, slug } = await params;
  const data = await getPostPageData(slug);
  const post = data.post;
  if (!post || post.category !== categoryParam) notFound();

  const { categories, settings } = data;
  const catName = labelForCategory(post.category, categories);
  const trending = [...data.sitePosts].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).slice(0, 5);
  const header = buildHeaderData({ settings, categories, posts: data.sitePosts, trending, activeSlug: post.category });
  const mins = readingMinutes(post.body);
  const commentCount = data.comments.length;
  const commentsEnabled = settings?.site.enableComments !== false;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsArticle",
        headline: post.title,
        description: post.excerpt || undefined,
        image: post.coverImage || post.ogImage || undefined,
        datePublished: post.publishedAt ?? post.createdAt,
        author: post.author?.name ? { "@type": "Person", name: post.author.name } : undefined,
        publisher: { "@type": "Organization", name: header.title },
        articleSection: catName,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "/" },
          { "@type": "ListItem", position: 2, name: catName, item: categoryHref(post.category) },
          { "@type": "ListItem", position: 3, name: post.title },
        ],
      },
    ],
  };

  return (
    <div className="site min-h-screen">
      <SiteHeader {...header} />
      <ViewCounter postId={post._id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main>
        <div className={`${PAD} pt-8`}>
          <AdSlot size="leaderboard" />
        </div>

        {/* Post header */}
        <div className={`${PAD} flex flex-col gap-3 pt-10`}>
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-[12px] text-ink-400">
            <Link href="/" className="text-ink-900 hover:text-accent">Home</Link>
            <span aria-hidden="true">»</span>
            <Link href={categoryHref(post.category)} className="text-ink-900 hover:text-accent">{catName}</Link>
            <span aria-hidden="true">»</span>
            <span className="line-clamp-1 max-w-full">{post.title}</span>
          </nav>
          <h1 className="max-w-[1010px] text-pretty font-serif text-[30px] font-bold leading-[1.2] sm:text-[38px]">{post.title}</h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 pt-1 text-[13px]">
            <AuthorAvatar src={post.author?.avatar} name={post.author?.name ?? "Brandish"} size={32} />
            <span className="text-ink-700">By <span className="font-semibold">{post.author?.name ?? "Brandish"}</span></span>
            <span className="text-ink-300" aria-hidden="true">—</span>
            <span className="text-ink-400">{formatDate(post)}</span>
            <span className="text-ink-300" aria-hidden="true">—</span>
            <Link href={categoryHref(post.category)} className="text-[11px] font-bold uppercase tracking-[0.08em] text-accent hover:text-accent-hover">{catName}</Link>
            <span className="ml-2 flex items-center gap-1.5 text-ink-400">
              <MessageCircle size={14} /> <span>{commentCount} Comment{commentCount === 1 ? "" : "s"}</span>
            </span>
            <span className="ml-2 flex items-center gap-1.5 text-ink-400">
              <Clock size={14} /> <span>{mins} Min{mins === 1 ? "" : "s"} Read</span>
            </span>
          </div>
        </div>

        {/* Band: share / article / sidebar */}
        <div className={`${PAD} flex flex-col gap-8 pb-4 pt-8 lg:flex-row lg:items-start lg:gap-[30px]`}>
          <div className="hidden lg:block lg:w-[56px] lg:shrink-0 lg:self-stretch">
            <ShareRail title={post.title} />
          </div>

          <article className="flex min-w-0 flex-1 flex-col gap-8 lg:max-w-[885px]">
            {post.format === "video" && post.videoId ? (
              <VideoEmbed videoId={post.videoId} title={post.title} />
            ) : (
              <Media post={post} className="aspect-[62/40]" sizes="(max-width: 1024px) 100vw, 885px" priority badge />
            )}

            <div className="lg:px-[88px]">
              <PostBody body={post.body} />
            </div>

            {/* Author box */}
            <div className="flex flex-col gap-6 pt-2">
              <span className="h-px bg-line" aria-hidden="true" />
              <div className="flex items-start gap-6">
                <AuthorAvatar src={post.author?.avatar} name={post.author?.name ?? "Brandish"} size={90} />
                <div className="flex flex-1 flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-6">
                    <span className="text-[15px] font-semibold text-ink-900">{post.author?.name ?? "Brandish"}</span>
                    <div className="flex gap-4 text-ink-500">
                      <HomeIcon size={16} /><Facebook size={16} /><XMark size={16} /><Pinterest size={16} /><Instagram size={16} />
                    </div>
                  </div>
                  <p className="text-[13px] leading-[1.7] text-ink-500">
                    {post.author?.name ?? "The Brandish team"} contributes reporting and analysis on {catName.toLowerCase()} for Brandish.
                  </p>
                </div>
              </div>
            </div>

            {/* Keep Reading */}
            {data.keepReading.length > 0 ? (
              <div className="flex flex-col gap-5 pt-2">
                <span className="h-0.5 bg-ink-900" aria-hidden="true" />
                <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-ink-900">Keep Reading</h2>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {data.keepReading.map((p) => (
                    <KeepReadingCard key={p._id} post={p} />
                  ))}
                </div>
              </div>
            ) : null}

            {/* Comments */}
            <div id="comments" className="flex flex-col gap-8 scroll-mt-24 pb-10 pt-4">
              {commentCount > 0 ? (
                <div className="flex flex-col gap-6">
                  <div className="flex justify-center">
                    <span className="rounded-sm border border-line px-10 py-[15px] text-[12px] font-bold uppercase tracking-[0.08em] text-accent">
                      {commentCount} Comment{commentCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-6 lg:px-[88px]">
                    {data.comments.map((c) => (
                      <li key={c._id} className="flex flex-col gap-1.5 border-b border-line pb-6">
                        <div className="flex items-center gap-2 text-[13px]">
                          <span className="font-semibold text-ink-900">{c.authorName}</span>
                          <span className="text-ink-300" aria-hidden="true">—</span>
                          <span className="text-ink-400">{formatDate({ publishedAt: c.createdAt, createdAt: c.createdAt } as Post)}</span>
                        </div>
                        <p className="text-[15px] leading-[1.7] text-ink-700">{c.body}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-center text-[14px] text-ink-400">No comments yet — be the first to comment.</p>
              )}

              {commentsEnabled ? (
                <div className="lg:px-[88px]">
                  <CommentForm postId={post._id} />
                </div>
              ) : null}
            </div>
          </article>

          {/* Sidebar */}
          <aside className="flex w-full flex-col gap-10 lg:w-[285px] lg:shrink-0 lg:self-stretch lg:border-l lg:border-t lg:border-line lg:pl-[30px] lg:pt-5">
            <EditorsPicksWidget posts={data.picks} />
            <LatestPostsWidget posts={data.latest} />
            <NewsletterWidget />
            <MpuAd />
          </aside>
        </div>
      </main>

      <SiteFooter title={header.title} categories={categories} />
    </div>
  );
}
