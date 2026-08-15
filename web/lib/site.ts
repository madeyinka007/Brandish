import { API_URL } from "./api";

// Server-only data layer for the public blog. Reads the CMS's public REST API with ISR
// (revalidate), so the homepage is statically generated and refreshed in the background.
// Nothing here is authenticated — these are the public GET endpoints (see docs/api-routes.md).

const REVALIDATE_SECONDS = 300;

export interface PostAuthor {
  _id: string;
  name: string;
  avatar?: string;
}
export interface Post {
  _id: string;
  title: string;
  slug: string;
  body?: unknown; // Tiptap JSON doc (present on single-post fetches)
  excerpt: string;
  coverImage: string;
  ogImage?: string;
  format: "article" | "gallery" | "video";
  category: string; // category slug
  tags: string[];
  author: PostAuthor;
  videoId: string | null;
  viewCount: number;
  publishedAt: string | null;
  createdAt: string;
}
export interface Category {
  _id: string;
  name: string;
  slug: string;
}
export interface PublicSettings {
  site: {
    title: string;
    logoUrl: string;
    tagline: string;
    description: string;
    postsPerPage: number;
    enableComments: boolean;
    maintenanceMode: boolean;
  };
  socials: { facebook: string; x: string; linkedin: string; instagram: string; whatsapp: string; youtube: string };
}

interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export async function getSettings(): Promise<PublicSettings | null> {
  return get<PublicSettings | null>("/api/settings", null);
}

export async function getCategories(): Promise<Category[]> {
  return get<Category[]>("/api/categories", []);
}

export async function getPublishedPosts(params: { category?: string; limit?: number } = {}): Promise<Post[]> {
  const qs = new URLSearchParams();
  if (params.category) qs.set("category", params.category);
  qs.set("limit", String(params.limit ?? 60));
  const res = await get<Paginated<Post>>(`/api/posts?${qs.toString()}`, {
    data: [],
    total: 0,
    page: 1,
    limit: 0,
    totalPages: 0,
  });
  return res.data;
}

// ---- helpers ----

/** "Jul 4, 2026" — the design's meta date format. Falls back to createdAt. */
export function formatDate(post: Post): string {
  const iso = post.publishedAt ?? post.createdAt;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function longDate(d = new Date()): string {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

/** Public URL of a post — the (planned) ISR route /[category]/[slug]. */
export function postHref(post: Post): string {
  return `/${post.category}/${post.slug}`;
}

export function categoryHref(slug: string): string {
  return `/${slug}`;
}

/** Human label for a category slug, using the loaded categories (falls back to a title-cased slug). */
export function labelForCategory(slug: string, categories: Category[]): string {
  const hit = categories.find((c) => c.slug === slug);
  if (hit) return hit.name;
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export interface HomeData {
  settings: PublicSettings | null;
  categories: Category[];
  posts: Post[];
  lead: Post | null;
  heroRows: Post[];
  secondary: Post | null;
  midRows: Post[];
  justIn: Post[];
  trending: Post[];
  editorsPicks: Post[];
  /** Category-labelled bands: the busiest categories, each with their own recent posts. */
  bands: { slug: string; label: string; posts: Post[] }[];
  /** Four categories for the bottom quad. */
  quad: { slug: string; label: string; posts: Post[] }[];
}

/**
 * Fetches everything the homepage needs and partitions the real posts into the design's slots.
 * The dataset is small, so — like a real newsroom homepage — a story can surface in more than
 * one context (lead + its category band + trending). Every slot degrades gracefully when a
 * category (or the whole site) has few posts.
 */
export async function getHomeData(): Promise<HomeData> {
  const [settings, categories, posts] = await Promise.all([
    getSettings(),
    getCategories(),
    getPublishedPosts({ limit: 60 }),
  ]);

  const byRecent = [...posts]; // API already sorts newest-first
  const byViews = [...posts].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));

  const postsIn = (slug: string) => posts.filter((p) => p.category === slug);

  // Categories that actually have posts, busiest first — these become the labelled bands.
  const populated = categories
    .map((c) => ({ slug: c.slug, label: c.name, posts: postsIn(c.slug) }))
    .filter((c) => c.posts.length > 0)
    .sort((a, b) => b.posts.length - a.posts.length);

  return {
    settings,
    categories,
    posts,
    lead: byRecent[0] ?? null,
    heroRows: byRecent.slice(1, 6),
    secondary: byRecent[6] ?? byRecent[1] ?? null,
    midRows: byRecent.slice(7, 10),
    justIn: byRecent.slice(0, 5),
    trending: byViews.slice(0, 4),
    editorsPicks: byViews.slice(0, 9),
    bands: populated.slice(0, 2),
    quad: (populated.length >= 4 ? populated : [...populated, ...populated]).slice(0, 4),
  };
}

// ── Header props (shared by the homepage-style header across pages) ──

export interface HeaderData {
  title: string;
  today: string;
  nav: { label: string; href: string; active?: boolean }[];
  ticker: { tag: string; title: string; href: string }[];
  search: { title: string; categoryLabel: string; date: string; href: string }[];
  chips: string[];
}

/** Builds the SiteHeader props. `activeSlug` marks the current section (undefined ⇒ Home active). */
export function buildHeaderData(opts: {
  settings: PublicSettings | null;
  categories: Category[];
  posts: Post[];
  trending: Post[];
  activeSlug?: string;
}): HeaderData {
  const { settings, categories, posts, trending, activeSlug } = opts;
  return {
    title: settings?.site.title || "Brandish",
    today: longDate(),
    nav: [
      { label: "Home", href: "/", active: !activeSlug },
      ...categories.slice(0, 8).map((c) => ({ label: c.name, href: categoryHref(c.slug), active: c.slug === activeSlug })),
    ],
    ticker: trending.map((p) => ({ tag: labelForCategory(p.category, categories), title: p.title, href: postHref(p) })),
    search: posts.map((p) => ({
      title: p.title,
      categoryLabel: labelForCategory(p.category, categories),
      date: formatDate(p),
      href: postHref(p),
    })),
    chips: categories.slice(0, 4).map((c) => c.name),
  };
}

// ── Category listing ──

export interface CategoryPageData {
  category: Category | null;
  settings: PublicSettings | null;
  categories: Category[];
  sitePosts: Post[];
  page: number;
  totalPages: number;
  total: number;
  // main stream
  feature: Post | null;
  twoUp: Post[];
  rows: Post[];
  // sidebar
  featured: Post | null;
  sideTop: Post[];
  picks: Post[];
  latest: Post[];
  recentComments: RecentComment[];
}

const CATEGORY_PER_PAGE = 11; // 1 feature + 2 two-up + up to 8 list rows

export async function getCategoryPageData(slug: string, page = 1): Promise<CategoryPageData> {
  const p = Math.max(1, Math.floor(page) || 1);
  const qs = new URLSearchParams({ category: slug, page: String(p), limit: String(CATEGORY_PER_PAGE) });
  const [settings, categories, catRes, sitePosts, recentComments] = await Promise.all([
    getSettings(),
    getCategories(),
    get<Paginated<Post>>(`/api/posts?${qs.toString()}`, { data: [], total: 0, page: p, limit: CATEGORY_PER_PAGE, totalPages: 0 }),
    getPublishedPosts({ limit: 24 }),
    getRecentComments(5),
  ]);

  const category = categories.find((c) => c.slug === slug) ?? null;
  const stream = catRes.data;
  const byViews = [...sitePosts].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));

  return {
    category,
    settings,
    categories,
    sitePosts,
    page: catRes.page || p,
    totalPages: catRes.totalPages || (stream.length ? 1 : 0),
    total: catRes.total,
    feature: stream[0] ?? null,
    twoUp: stream.slice(1, 3),
    rows: stream.slice(3, 11),
    featured: byViews[0] ?? null,
    sideTop: byViews.slice(1, 3),
    picks: byViews.slice(3, 7),
    latest: sitePosts.slice(0, 3),
    recentComments,
  };
}

// ── Post detail ──

export interface PostComment {
  _id: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  return get<Post | null>(`/api/posts/${encodeURIComponent(slug)}`, null);
}

/** Approved comments for a post — mapped to safe public fields only (never authorEmail). */
export async function getApprovedComments(postId: string): Promise<PostComment[]> {
  const raw = await get<Array<Record<string, unknown>>>(`/api/comments?postId=${encodeURIComponent(postId)}`, []);
  return (Array.isArray(raw) ? raw : []).map((c) => ({
    _id: String(c._id),
    authorName: typeof c.authorName === "string" ? c.authorName : "Anonymous",
    body: typeof c.body === "string" ? c.body : "",
    createdAt: typeof c.createdAt === "string" ? c.createdAt : "",
  }));
}

/** A recent approved comment joined to the post it belongs to — backs the Recent Comments widget. */
export interface RecentComment {
  _id: string;
  authorName: string;
  body: string;
  createdAt: string;
  post: { title: string; slug: string; category: string } | null;
}

/** Recent approved comments across all posts (safe fields only — never authorEmail). */
export async function getRecentComments(limit = 5): Promise<RecentComment[]> {
  const raw = await get<Array<Record<string, unknown>>>(`/api/comments`, []);
  const list = (Array.isArray(raw) ? raw : []).map((c) => {
    const p = c.post as Record<string, unknown> | null | undefined;
    return {
      _id: String(c._id),
      authorName: typeof c.authorName === "string" ? c.authorName : "Anonymous",
      body: typeof c.body === "string" ? c.body : "",
      createdAt: typeof c.createdAt === "string" ? c.createdAt : "",
      post:
        p && typeof p.slug === "string" && typeof p.category === "string"
          ? { title: typeof p.title === "string" ? p.title : "", slug: p.slug, category: p.category }
          : null,
    };
  });
  return list.slice(0, limit);
}

/** Plain text of a Tiptap doc — for reading-time + meta descriptions. */
export function bodyToText(body: unknown): string {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as { text?: unknown; content?: unknown };
    if (typeof n.text === "string") out.push(n.text);
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk(body);
  return out.join(" ");
}

export function readingMinutes(body: unknown): number {
  const words = bodyToText(body).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export interface PostPageData {
  post: Post | null;
  category: Category | null;
  settings: PublicSettings | null;
  categories: Category[];
  sitePosts: Post[];
  keepReading: Post[];
  picks: Post[];
  latest: Post[];
  comments: PostComment[];
}

export async function getPostPageData(slug: string): Promise<PostPageData> {
  const post = await getPostBySlug(slug);
  if (!post) {
    const [settings, categories] = await Promise.all([getSettings(), getCategories()]);
    return { post: null, category: null, settings, categories, sitePosts: [], keepReading: [], picks: [], latest: [], comments: [] };
  }
  const [settings, categories, sitePosts, comments] = await Promise.all([
    getSettings(),
    getCategories(),
    getPublishedPosts({ limit: 24 }),
    getApprovedComments(post._id),
  ]);
  const others = sitePosts.filter((p) => p._id !== post._id);
  const sameCat = others.filter((p) => p.category === post.category);
  const keepReading = [...sameCat, ...others.filter((p) => p.category !== post.category)].slice(0, 6);
  const byViews = [...others].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
  return {
    post,
    category: categories.find((c) => c.slug === post.category) ?? null,
    settings,
    categories,
    sitePosts,
    keepReading,
    picks: byViews.slice(0, 4),
    latest: others.slice(0, 3),
    comments,
  };
}
