import type { Metadata } from "next";
import {
  type Post,
  categoryHref,
  formatDate,
  getHomeData,
  getSettings,
  labelForCategory,
  longDate,
  postHref,
} from "@/lib/site";
import SiteHeader from "@/components/public/SiteHeader";
import SiteFooter from "@/components/public/SiteFooter";
import AdSlot from "@/components/public/AdSlot";
import {
  CategoryQuad,
  FeatureBand,
  HeroBand,
  MoneyTechBand,
  TrendingStrip,
} from "@/components/public/sections";
import type { NavItem } from "@/components/public/MobileMenu";

// Refresh the statically-generated homepage in the background (ISR).
export const revalidate = 300;

// Shared responsive page gutter (matches the header/footer: 120px at desktop).
const PAD = "px-4 sm:px-8 lg:px-16 xl:px-[120px]";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const title = settings?.site.title || "Brandish";
  const description =
    settings?.site.description ||
    settings?.site.tagline ||
    "Nigerian business media — money, energy, FMCG and the brands shaping them.";
  return {
    title: { default: title, template: `%s · ${title}` },
    description,
    openGraph: { title, description, type: "website", siteName: title },
    twitter: { card: "summary_large_image", title, description },
  };
}

/** `slice` that wraps around a short pool so dense bands still fill (like a real news homepage). */
function pick(posts: Post[], start: number, count: number): Post[] {
  if (posts.length === 0) return [];
  return Array.from({ length: Math.min(count, posts.length) }, (_, i) => posts[(start + i) % posts.length]);
}

export default async function HomePage() {
  const home = await getHomeData();
  const { settings, categories, posts } = home;

  const siteTitle = settings?.site.title || "Brandish";

  // Maintenance mode → serve a minimal holding page (admin stays reachable).
  if (settings?.site.maintenanceMode) {
    return (
      <main className="site flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <span className="font-serif text-[32px] font-bold text-ink-900">{siteTitle}</span>
        <p className="max-w-md text-ink-500">We’re making some changes and will be back shortly.</p>
      </main>
    );
  }

  // Empty-state: no published content yet.
  if (posts.length === 0) {
    return (
      <div className="site min-h-screen">
        <SiteHeader
          title={siteTitle}
          today={longDate()}
          nav={buildNav(categories)}
          ticker={[]}
          search={[]}
          chips={[]}
        />
        <main className="mx-auto flex max-w-[600px] flex-col items-center gap-3 px-6 py-32 text-center">
          <h1 className="font-serif text-[28px] font-bold text-ink-900">Nothing published yet</h1>
          <p className="text-ink-500">Once the newsroom publishes its first stories, they’ll appear here.</p>
        </main>
        <SiteFooter title={siteTitle} categories={categories} />
      </div>
    );
  }

  const nav = buildNav(categories);
  const ticker = home.trending.map((p) => ({
    tag: labelForCategory(p.category, categories),
    title: p.title,
    href: postHref(p),
  }));
  const search = posts.map((p) => ({
    title: p.title,
    categoryLabel: labelForCategory(p.category, categories),
    date: formatDate(p),
    href: postHref(p),
  }));
  const chips = categories.slice(0, 4).map((c) => c.name);

  // Real per-category slices for the mid-page bands.
  const inCat = (slug: string) => posts.filter((p) => p.category === slug);
  const used = new Set<string>();
  // Pattern-A feature band: the busiest category that isn't Money/Technology (those anchor band B).
  const featureCat = home.bands.find((b) => b.slug !== "money" && b.slug !== "technology") ?? home.bands[0];
  if (featureCat) used.add(featureCat.slug);
  const fb = featureCat ? featureCat.posts : [];
  // Pattern-B Money/Tech band.
  const moneyPosts = inCat("money");
  const techPosts = inCat("technology");
  used.add("money");
  used.add("technology");
  // Quad: four categories not already featured above.
  const quad = categories
    .filter((c) => !used.has(c.slug))
    .slice(0, 4)
    .map((c) => ({ slug: c.slug, label: c.name, posts: inCat(c.slug) }));

  return (
    <div className="site min-h-screen">
      <SiteHeader
        title={siteTitle}
        today={longDate()}
        nav={nav}
        ticker={ticker}
        search={search}
        chips={chips}
      />

      <main>
        <TrendingStrip posts={home.trending} categories={categories} />

        <HeroBand
          lead={home.lead}
          heroRows={home.heroRows}
          secondary={home.secondary}
          midRows={home.midRows}
          opinion={pick(posts, 3, 3)}
          justIn={home.justIn}
          stacked={pick(posts, 7, 2)}
          categories={categories}
        />

        <div className={`${PAD} pt-10 sm:pt-16`}>
          <AdSlot size="leaderboard" />
        </div>

        {featureCat && fb[0] ? (
          <FeatureBand
            label="Corporate Brand"
            feature={fb[0]}
            sub={fb.slice(1, 4)}
            side={fb.slice(4, 9)}
            categories={categories}
          />
        ) : null}

        <MoneyTechBand
          primaryLabel={labelForCategory("money", categories)}
          primaryHref={categoryHref("money")}
          primary={moneyPosts}
          secondaryLabel={labelForCategory("technology", categories)}
          secondaryHref={categoryHref("technology")}
          secondary={techPosts}
          picks={home.editorsPicks}
          categories={categories}
        />

        <div className={`${PAD} pt-10 sm:pt-16`}>
          <AdSlot size="leaderboard" />
        </div>

        <CategoryQuad columns={quad} categories={categories} />
      </main>

      <SiteFooter title={siteTitle} categories={categories} />
    </div>
  );
}

function buildNav(categories: { name: string; slug: string }[]): NavItem[] {
  return [
    { label: "Home", href: "/", active: true },
    ...categories.slice(0, 8).map((c) => ({ label: c.name, href: categoryHref(c.slug), active: false })),
  ];
}
