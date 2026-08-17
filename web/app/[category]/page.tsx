import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildHeaderData, getCategoryPageData, getSettings } from "@/lib/site";
import SiteHeader from "@/components/public/SiteHeader";
import SiteFooter from "@/components/public/SiteFooter";
import AdSlot from "@/components/public/AdSlot";
import CategoryListing from "@/components/public/CategoryListing";

export const revalidate = 300;

const PAD = "px-5 tab:px-8 lap:px-10 wide:px-[120px]";

type Params = { params: Promise<{ category: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { category: slug } = await params;
  const [settings, data] = await Promise.all([getSettings(), getCategoryPageData(slug, 1)]);
  const site = settings?.site.title || "Brandish";
  if (!data.category) return { title: "Not found" };
  const name = data.category.name;
  const description = `The latest ${name} reporting and analysis from ${site}.`;
  return {
    title: name,
    description,
    alternates: { canonical: `/${slug}` },
    openGraph: { title: `${name} · ${site}`, description, type: "website" },
  };
}

export default async function CategoryPage({ params, searchParams }: Params) {
  const { category: slug } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const data = await getCategoryPageData(slug, page);
  if (!data.category) notFound();

  const trending = [...data.sitePosts].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).slice(0, 5);
  const header = buildHeaderData({
    settings: data.settings,
    categories: data.categories,
    posts: data.sitePosts,
    trending,
    activeSlug: slug,
  });
  const name = data.category.name;

  return (
    <div className="site min-h-screen">
      <SiteHeader {...header} />

      <main>
        <div className={`${PAD} pt-8`}>
          <AdSlot size="leaderboard" />
        </div>

        {/* Page header — breadcrumb + title */}
        <div className={`${PAD} flex flex-col gap-5 pt-8`}>
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[12px] text-ink-400">
            <Link href="/" className="text-ink-900 hover:text-accent">
              Home
            </Link>
            <span aria-hidden="true">»</span>
            <span>
              Category: <span className="text-ink-700">“{name}”</span>
            </span>
          </nav>
          <div className="flex flex-col gap-3">
            <h1 className="font-serif text-[28px] font-bold leading-[1.15] sm:text-[34px]">{name}</h1>
            <span className="h-px bg-ink-900" aria-hidden="true" />
          </div>
        </div>

        <CategoryListing data={data} base={`/${slug}`} />
      </main>

      <SiteFooter title={header.title} categories={data.categories} />
    </div>
  );
}
