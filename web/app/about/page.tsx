import type { Metadata } from "next";
import Link from "next/link";
import {
  buildHeaderData,
  categoryHref,
  formatDate,
  getCategories,
  getPublishedPosts,
  getSettings,
  postHref,
} from "@/lib/site";
import SiteHeader from "@/components/public/SiteHeader";
import SiteFooter from "@/components/public/SiteFooter";
import { Media, SectionLabel } from "@/components/public/primitives";
import { NewsletterWidget } from "@/components/public/widgets";
import { ChevronRight } from "@/components/public/icons";

// Rendered per request rather than prerendered with ISR.
//
// This page has no dynamic route segment, so Next prerenders it at build time and refreshes it
// via ISR. On this Amplify deployment that background revalidation does not actually regenerate
// the page: it kept reporting `x-nextjs-cache: HIT` while serving build-time HTML, so newly
// published posts never appeared and deleted ones never left — the homepage only ever changed
// when a deploy rebuilt it. The sibling routes (/[category], /[category]/[slug]) were always
// correct precisely because their dynamic segments have no generateStaticParams, so Next could
// not prerender them and served them on demand instead.
//
// force-dynamic makes that the explicit strategy here too. The cost is a compute invocation and
// the page's API fan-out on every request; the durable fix is on-demand revalidation (have the
// API call revalidatePath() when a post changes), which would let this go back to being static.
export const dynamic = "force-dynamic";

const PAD = "px-5 tab:px-8 lap:px-10 wide:px-[120px]";

const LEAD =
  "Brandish is an eponymously named publication of Brandish Media & Communications Ltd. Our area of focus is marketing communications. Everything concerning branding, marketing, sales, and the creation of successful and enduring enterprises captures our interest.";
const BODY =
  "We are players in the industry and understand it quite well enough to interpret it for professionals and those operating from outside. We possess the experience and knowledge to own the bragging rights as the authorities in brands and marketing reportage in Nigeria.";

// The "What we cover" beats — drawn from our own focus areas (branding · marketing · sales · enterprise).
const BEATS = [
  { title: "Branding", blurb: "Identity, positioning and the work of building recognition that lasts." },
  { title: "Marketing", blurb: "Campaigns, media spend and the strategy behind what audiences see." },
  { title: "Sales", blurb: "How products reach market and what moves buyers to commit." },
  { title: "Enterprise", blurb: "The founders and firms turning ventures into enduring businesses." },
];

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const site = settings?.site.title || "Brandish";
  const description = LEAD.slice(0, 200);
  return {
    title: "About us",
    description,
    alternates: { canonical: "/about" },
    openGraph: { title: `About us · ${site}`, description, type: "website", siteName: site },
    twitter: { card: "summary_large_image", title: `About us · ${site}`, description },
  };
}

export default async function AboutPage() {
  const [settings, categories, sitePosts] = await Promise.all([
    getSettings(),
    getCategories(),
    getPublishedPosts({ limit: 24 }),
  ]);

  const byViews = [...sitePosts].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
  // activeSlug "about" is intentionally not a real section — it leaves every nav item inactive.
  const header = buildHeaderData({ settings, categories, posts: sitePosts, trending: byViews.slice(0, 5), activeSlug: "about" });
  const mostRead = byViews.slice(0, 3);

  return (
    <div className="site min-h-screen">
      <SiteHeader {...header} />

      <main>
        {/* Page header */}
        <div className={`${PAD} flex flex-col gap-5 pt-8`}>
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-[12px] text-ink-400">
            <Link href="/" className="text-ink-900 hover:text-accent">Home</Link>
            <span aria-hidden="true">»</span>
            <span>About us</span>
          </nav>
          <div className="flex flex-col gap-3">
            <h1 className="text-pretty font-serif text-[28px] font-bold leading-[1.15] sm:text-[34px]">About us</h1>
            <span className="h-px bg-ink-900" aria-hidden="true" />
          </div>
        </div>

        {/* Band — 9 / 3 */}
        <div className={`${PAD} flex flex-col gap-10 pb-20 pt-8 lg:flex-row lg:items-start lg:gap-[30px]`}>
          {/* Main column (885px) */}
          <div className="flex min-w-0 flex-col gap-10 lg:w-[885px] lg:shrink-0">
            <Media className="aspect-[21/9]" />

            <div className="flex flex-col gap-6 lg:max-w-[680px]">
              <p className="text-pretty font-serif text-[20px] font-normal leading-[1.55] text-ink-900 sm:text-[22px]">{LEAD}</p>
              <p className="text-pretty text-[17px] leading-[1.75] text-ink-700">{BODY}</p>
            </div>

            {/* What we cover */}
            <div className="flex flex-col gap-6 pt-2">
              <SectionLabel>What we cover</SectionLabel>
              <div className="grid grid-cols-2 gap-[30px] sm:grid-cols-4">
                {BEATS.map((b) => (
                  <div key={b.title} className="flex flex-col gap-3">
                    <Media className="aspect-[3/2]" />
                    <h3 className="font-serif text-[16px] font-bold leading-[1.35] text-ink-900">{b.title}</h3>
                    <p className="text-[14px] leading-[1.6] text-ink-500">{b.blurb}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Rail — Categories · Most read · Newsletter */}
          <aside className="flex w-full flex-col gap-10 lg:flex-1 lg:border-l lg:border-line lg:pl-[30px]">
            {categories.length > 0 ? (
              <div className="flex flex-col gap-5">
                <SectionLabel>Categories</SectionLabel>
                <div className="flex flex-col">
                  {categories.slice(0, 8).map((c) => (
                    <Link
                      key={c._id}
                      href={categoryHref(c.slug)}
                      className="flex items-center justify-between gap-3 border-b border-line py-[11px] text-[14px] font-medium text-ink-900 transition-colors hover:text-accent"
                    >
                      <span>{c.name}</span>
                      <ChevronRight size={14} className="text-ink-400" />
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            {mostRead.length > 0 ? (
              <div className="flex flex-col gap-5">
                <SectionLabel>Most read</SectionLabel>
                <div className="flex flex-col">
                  {mostRead.map((p, i) => (
                    <Link
                      key={p._id}
                      href={postHref(p)}
                      className="group flex items-start gap-3 border-b border-line pb-5 [&:not(:first-child)]:pt-5"
                    >
                      <span className="font-serif text-[28px] font-light leading-none text-ink-300" aria-hidden="true">{i + 1}</span>
                      <span className="flex flex-col gap-1">
                        <span className="font-serif text-[15px] font-semibold leading-[1.4] text-ink-900 transition-colors group-hover:text-accent">{p.title}</span>
                        <span className="text-[12px] text-ink-400">{formatDate(p)}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            <NewsletterWidget />
          </aside>
        </div>
      </main>

      <SiteFooter title={header.title} categories={categories} />
    </div>
  );
}
