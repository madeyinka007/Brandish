import 'dotenv/config';
import { ObjectId, type Document } from 'mongodb';
import { getDb } from '../lib/mongodb';
import { slugify } from '../lib/slug';

/**
 * Content seed for the public site. Two things:
 *   1. Enriches EVERY existing post — longer excerpt, a full multi-paragraph body, and a cover
 *      image (real posts are left otherwise untouched: title/category/author/slug preserved).
 *   2. Tops the library up to TARGET_TOTAL (100) published posts spread across all categories,
 *      each with a cover image, excerpt, body, tags, author, view count and a spread publish date.
 *
 * Demo-generated posts carry `seedDemo: true`, so re-running is idempotent (they're cleared and
 * regenerated) and they never collide with real editorial content. Cover images are loremflickr
 * placeholders keyed by slug — swap them for real S3/CloudFront media as the newsroom publishes.
 *
 * Run:  node --env-file=.env node_modules/.bin/ts-node scripts/seedPosts.ts
 *   or: npm run seed:posts
 */
const TARGET_TOTAL = 100;

/**
 * Deterministic placeholder cover for a seeded post, keyed by slug so a given post always gets
 * the same picture, and by category so the picture is at least topically plausible.
 *
 * This was picsum.photos until that service went down and took every cover image on the live
 * site with it — a dead upstream makes next/image time out rather than fail fast, so the
 * homepage rendered empty boxes. loremflickr is a like-for-like replacement (real, varied
 * photography rather than flat grey boxes; `lock` keeps the choice stable) but it is still
 * someone else's free service and can fail exactly the same way. These are placeholders: the
 * durable fix is real cover art in the S3/CloudFront media library, at which point this helper
 * and the loremflickr entry in web/next.config.mjs both go away.
 */
const coverLock = (slug: string): number => {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return (h % 100000) + 1;
};
const coverTopic = (cat?: CatVocab): string =>
  (cat?.theme ?? 'business').toLowerCase().replace(/[^a-z]+/g, ',').replace(/^,|,$/g, '');
const cover = (slug: string, cat?: CatVocab) =>
  `https://loremflickr.com/1200/675/${coverTopic(cat)}?lock=${coverLock(slug)}`;
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const rand = (min: number, max: number) => Math.floor(min + Math.random() * (max - min + 1));

// ── Category-specific vocabulary for headline + copy generation ──
interface CatVocab {
  slug: string;
  theme: string; // used in body/excerpt copy
  subjects: string[];
  objects: string[];
  tags: string[];
}
const CATEGORIES: CatVocab[] = [
  {
    slug: 'money',
    theme: 'financial services',
    subjects: ['The Central Bank', 'Fintech Startups', 'Commercial Lenders', 'Pension Funds', 'Digital Banks', 'Microfinance Operators', 'Institutional Investors', 'The Treasury', 'Payment Processors', 'Asset Managers'],
    objects: ['Cross-Border Payments', 'Naira Liquidity', 'Lending Rates', 'Capital Controls', 'Open Banking Rules', 'Deposit Insurance', 'Foreign Reserves', 'Consumer Credit', 'Digital-Currency Pilots', 'Remittance Corridors'],
    tags: ['banking', 'fintech', 'markets'],
  },
  {
    slug: 'advertising',
    theme: 'brand marketing',
    subjects: ['Agencies', 'Media Buyers', 'Brand Marketers', 'Creative Studios', 'Ad Networks', 'Retail Advertisers', 'Streaming Platforms', 'Out-of-Home Operators', 'Influencer Marketers', 'The Regulator'],
    objects: ['Programmatic Spend', 'First-Party Data', 'Connected-TV Budgets', 'Retail Media', 'Creator Partnerships', 'Attention Metrics', 'Brand Safety Rules', 'Measurement Standards', 'Sponsorship Deals', 'Ad-Fraud Controls'],
    tags: ['brand-strategy', 'media', 'campaigns'],
  },
  {
    slug: 'public-relations',
    theme: 'corporate communications',
    subjects: ['Comms Teams', 'PR Agencies', 'Corporate Affairs Chiefs', 'Crisis Advisers', 'Investor-Relations Leads', 'Government Spokespeople', 'Brand Reputation Firms', 'Public Affairs Units', 'Newsroom Partners', 'Executive Coaches'],
    objects: ['Crisis Playbooks', 'Reputation Metrics', 'Stakeholder Trust', 'Media Relations', 'Executive Visibility', 'Message Discipline', 'ESG Storytelling', 'Newsroom Strategy', 'Influencer Vetting', 'Internal Comms'],
    tags: ['reputation', 'strategy', 'media'],
  },
  {
    slug: 'telco',
    theme: 'telecommunications',
    subjects: ['Network Operators', 'Tower Companies', 'The Spectrum Regulator', 'Fibre Providers', 'Mobile Carriers', 'Data-Centre Firms', 'Satellite Players', 'Enterprise ISPs', 'Handset Makers', 'Roaming Partners'],
    objects: ['5G Rollout', 'Spectrum Auctions', 'Fibre Expansion', 'Data Tariffs', 'Rural Coverage', 'Network Uptime', 'SIM Registration', 'Interconnect Fees', 'Edge Infrastructure', 'Roaming Costs'],
    tags: ['5g', 'infrastructure', 'connectivity'],
  },
  {
    slug: 'leadership',
    theme: 'management and strategy',
    subjects: ['Chief Executives', 'Boards', 'Founders', 'People Officers', 'Operating Chiefs', 'Family Businesses', 'Turnaround Specialists', 'Growth-Stage Leaders', 'Non-Executives', 'Management Consultants'],
    objects: ['Succession Planning', 'Hybrid Work', 'Culture Change', 'Board Governance', 'Talent Retention', 'Decision-Making', 'Restructuring Plans', 'Performance Reviews', 'Leadership Pipelines', 'Founder Transitions'],
    tags: ['management', 'strategy', 'workplace'],
  },
  {
    slug: 'fmcg',
    theme: 'consumer goods',
    subjects: ['Consumer-Goods Makers', 'Retail Chains', 'Beverage Firms', 'Distributors', 'Packaged-Food Brands', 'Personal-Care Companies', 'Wholesalers', 'Supermarket Operators', 'Cold-Chain Providers', 'Household Brands'],
    objects: ['Pricing Strategy', 'Supply Chains', 'Shelf Space', 'Rural Distribution', 'Private Labels', 'Packaging Costs', 'Demand Signals', 'Route-to-Market', 'Product Launches', 'Input Inflation'],
    tags: ['retail', 'consumer', 'supply-chain'],
  },
  {
    slug: 'energy',
    theme: 'power and energy',
    subjects: ['Power Producers', 'The Grid Operator', 'Oil Majors', 'Solar Developers', 'Gas Suppliers', 'Distribution Companies', 'Off-Grid Startups', 'Regulators', 'Refiners', 'Utility Investors'],
    objects: ['Grid Reliability', 'Tariff Reform', 'Solar Capacity', 'Gas Supply', 'Metering Rollout', 'Fuel Subsidies', 'Transmission Upgrades', 'Renewable Targets', 'Refining Output', 'Energy Access'],
    tags: ['power', 'renewables', 'oil-gas'],
  },
  {
    slug: 'entertainment',
    theme: 'media and entertainment',
    subjects: ['Streaming Services', 'Film Studios', 'Music Labels', 'Content Creators', 'Cinema Chains', 'Talent Agencies', 'Live-Event Promoters', 'Gaming Studios', 'Broadcasters', 'Distribution Platforms'],
    objects: ['Streaming Rights', 'Box-Office Returns', 'Creator Economics', 'Music Royalties', 'Original Content', 'Live Tours', 'Licensing Deals', 'Audience Data', 'Franchise Strategy', 'Distribution Windows'],
    tags: ['streaming', 'film', 'music'],
  },
  {
    slug: 'government',
    theme: 'policy and public sector',
    subjects: ['Policymakers', 'The Finance Ministry', 'Lawmakers', 'Regulators', 'State Agencies', 'Trade Officials', 'The Central Government', 'Public-Sector Reformers', 'Tax Authorities', 'Development Partners'],
    objects: ['Tax Reform', 'Trade Policy', 'Public Spending', 'Regulatory Overhaul', 'Digital ID', 'Procurement Rules', 'Fiscal Targets', 'Local Content', 'Subsidy Policy', 'Investment Incentives'],
    tags: ['policy', 'regulation', 'economy'],
  },
  {
    slug: 'technology',
    theme: 'technology and innovation',
    subjects: ['Startups', 'Cloud Providers', 'AI Labs', 'Software Firms', 'Chip Designers', 'Platform Companies', 'Cybersecurity Vendors', 'Developer Communities', 'Hardware Makers', 'Venture Investors'],
    objects: ['AI Adoption', 'Cloud Migration', 'Data Privacy', 'Developer Tooling', 'Cybersecurity', 'Product Launches', 'Chip Supply', 'Platform Rules', 'Open Source', 'Funding Rounds'],
    tags: ['ai', 'startups', 'software'],
  },
];

const ACTIONS = [
  'Rethinks', 'Accelerates', 'Doubles Down on', 'Bets Big on', 'Rolls Out', 'Unveils', 'Weighs',
  'Tightens', 'Warns Over', 'Overhauls', 'Faces Scrutiny Over', 'Moves to Fix', 'Races to Scale',
  'Sets New Rules for', 'Rethinks Its Approach to',
];
const DRIVERS = [
  'as costs climb', 'amid shifting demand', 'in a bid to win share', 'as competition intensifies',
  'to steady the market', 'as regulators circle', 'in a play for growth', 'as the outlook brightens',
];

function makeTitle(cat: CatVocab, used: Set<string>): string {
  for (let attempt = 0; attempt < 40; attempt++) {
    const base = `${pick(cat.subjects)} ${pick(ACTIONS)} ${pick(cat.objects)}`;
    const title = Math.random() < 0.35 ? `${base} ${pick(DRIVERS)}` : base;
    if (!used.has(title)) {
      used.add(title);
      return title;
    }
  }
  return `${pick(cat.subjects)} ${pick(ACTIONS)} ${pick(cat.objects)} — ${Date.now() % 10000}`;
}

function makeExcerpt(cat: CatVocab): string {
  const a = [
    `As ${cat.theme} enters a more demanding cycle, executives are weighing fresh strategies to stay ahead of the market.`,
    `The shift is reshaping how leaders across ${cat.theme} think about growth, risk and where to place their next bets.`,
    `Momentum is building across ${cat.theme}, and the players moving first are already reporting measurable gains.`,
  ];
  const b = [
    `Analysts say the coming months will separate the firms that adapt quickly from those that hesitate.`,
    `Early movers point to stronger margins and steadier demand, but the road ahead is far from settled.`,
    `Insiders describe a rare window of opportunity — provided the fundamentals hold and confidence returns.`,
    `Much now depends on execution, timing and whether the wider economy cooperates over the next few quarters.`,
  ];
  return `${pick(a)} ${pick(b)}`;
}

function makeBody(title: string, cat: CatVocab): Document {
  const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
  const h = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });
  const paras = [
    `${title}. That is the picture emerging across ${cat.theme} this quarter, as decision-makers move to get ahead of a market that is changing faster than many expected.`,
    `Behind the shift is a familiar mix of pressures — rising costs, sharper competition and customers whose expectations keep climbing. Leaders who spoke for this report describe a period of unusual clarity about what has to change, even where the path to get there is still being drawn.`,
    `"The fundamentals have not gone away, but the playbook has," one senior executive said, asking not to be named while plans are finalised. "The organisations that win from here will be the ones that make fewer, better bets and follow through on them."`,
    h('What is driving the change'),
    `Three forces stand out. The first is cost: input prices remain stubborn, forcing a hard look at where value is really created. The second is competition, as newer entrants reset expectations on price and speed. The third is capability — the quiet, unglamorous work of fixing processes and data so decisions can be made with confidence.`,
    `For now, the numbers tell a cautiously optimistic story. Firms that invested early are seeing steadier demand and healthier margins, while those that delayed are playing catch-up. The gap between the two groups is widening, and it is becoming the defining feature of ${cat.theme} in the current cycle.`,
    `What happens next will depend on execution as much as strategy. The ambition is clear across the sector; the harder question is whether teams can deliver against it while the wider economy remains uneven. On that, the coming quarters will be decisive.`,
  ];
  return { type: 'doc', content: paras.map((x) => (typeof x === 'string' ? p(x) : x)) };
}

interface AuthorSnap {
  _id: ObjectId;
  name: string;
  avatar: string;
}

export async function seedPosts(): Promise<{ updated: number; created: number; total: number }> {
  const db = await getDb();
  const posts = db.collection('posts');

  const authorDocs = (await db
    .collection('users')
    .find({ role: { $in: ['super-admin', 'editor', 'author'] } }, { projection: { name: 1, avatar: 1 } })
    .toArray()) as Array<{ _id: ObjectId; name: string; avatar?: string }>;
  if (authorDocs.length === 0) {
    console.log('Seed posts: no content-role users to author with. Seed users first.');
    return { updated: 0, created: 0, total: 0 };
  }
  const authors: AuthorSnap[] = authorDocs.map((u) => ({ _id: u._id, name: u.name, avatar: u.avatar ?? '' }));

  const usedTitles = new Set<string>();
  const usedSlugs = new Set<string>();
  const uniqueSlug = (title: string) => {
    const base = slugify(title) || 'post';
    let slug = base;
    let n = 2;
    while (usedSlugs.has(slug)) slug = `${base}-${n++}`;
    usedSlugs.add(slug);
    return slug;
  };

  // 1) Enrich existing (non-demo) posts.
  const existing = (await posts.find({ seedDemo: { $ne: true } }).toArray()) as Array<{
    _id: ObjectId;
    title: string;
    slug: string;
    category: string;
  }>;
  let updated = 0;
  for (const post of existing) {
    usedTitles.add(post.title);
    usedSlugs.add(post.slug);
    const cat = CATEGORIES.find((c) => c.slug === post.category) ?? CATEGORIES[0];
    await posts.updateOne(
      { _id: post._id },
      {
        $set: {
          excerpt: makeExcerpt(cat),
          body: makeBody(post.title, cat),
          coverImage: cover(post.slug, cat),
          ogImage: cover(post.slug, cat),
        },
      },
    );
    updated++;
  }

  // 2) Clear previous demo posts, then top up to TARGET_TOTAL.
  await posts.deleteMany({ seedDemo: true });
  const now = Date.now();
  const need = Math.max(0, TARGET_TOTAL - updated);
  const docs: Document[] = [];
  for (let i = 0; i < need; i++) {
    const cat = CATEGORIES[i % CATEGORIES.length]; // even spread across categories
    const title = makeTitle(cat, usedTitles);
    const slug = uniqueSlug(title);
    const isVideo = i % 11 === 0;
    const publishedAt = new Date(now - rand(1, 180) * 24 * 3600 * 1000 - rand(0, 23) * 3600 * 1000);
    docs.push({
      title,
      slug,
      body: makeBody(title, cat),
      excerpt: makeExcerpt(cat),
      format: isVideo ? 'video' : 'article',
      coverImage: cover(slug, cat),
      category: cat.slug,
      tags: [pick(cat.tags), pick(cat.tags)].filter((v, idx, a) => a.indexOf(v) === idx),
      author: pick(authors),
      media: [],
      videoId: isVideo ? 'dQw4w9WgXcQ' : null,
      keywords: `${cat.slug}, ${cat.tags.join(', ')}`,
      ogImage: cover(slug, cat),
      status: 'published',
      viewCount: rand(150, 9500),
      publishedAt,
      createdAt: publishedAt,
      seedDemo: true,
    });
  }
  if (docs.length > 0) {
    for (let i = 0; i < docs.length; i += 500) await posts.insertMany(docs.slice(i, i + 500));
  }

  const total = await posts.countDocuments({ status: 'published' });
  console.log(`Seed posts: enriched ${updated} existing, created ${docs.length} new → ${total} published total.`);
  return { updated, created: docs.length, total };
}

if (require.main === module) {
  seedPosts()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
