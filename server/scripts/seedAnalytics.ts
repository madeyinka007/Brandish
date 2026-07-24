import 'dotenv/config';
import { ObjectId, type Document } from 'mongodb';
import { getDb } from '../lib/mongodb';

/**
 * Seeds demo `page_views` events so the admin analytics dashboard has realistic data to derive
 * every panel from (views trend, sources, devices, countries, top posts, bounce, avg time).
 * Also syncs each post's `viewCount` to the number of events it received, so the content list
 * and analytics agree.
 *
 * Modelled as a pool of distinct visitors (not one random IP per view) so that unique-visitors
 * is meaningfully lower than total views and the bounce rate (share of one-page visitors) lands
 * in a realistic band. Each visitor keeps a stable IP (geo-mappable — see analytics.geoFromIp)
 * and device; their visits spread across the last 60 days with a gentle upward trend, weighted
 * toward the more popular posts. Every event carries `dwellSec` (time-on-page).
 *
 * Demo events are tagged `_demo: true` so re-running is idempotent and real traffic is never
 * touched.
 *
 * Run:  node --env-file=.env node_modules/.bin/ts-node scripts/seedAnalytics.ts
 *   or: npm run seed:analytics
 */
const DAYS = 60;
const NUM_VISITORS = 4200;

// How many pages a visitor reads in the window → shapes unique-visitors vs views and bounce.
// [pagesRead, weight]. ~38% read a single page (they "bounce").
const VISIT_DEPTH: Array<[number, number]> = [
  [1, 38],
  [2, 22],
  [3, 15],
  [4, 12],
  [5, 8],
  [7, 5],
];

// Audience by country (weight) → the IP blocks analytics.geoFromIp recognises.
const COUNTRIES: Array<{ blocks: string[]; weight: number }> = [
  { blocks: ['102.89.', '105.112.', '197.210.'], weight: 44 }, // Nigeria
  { blocks: ['12.34.', '23.62.'], weight: 22 }, // United States
  { blocks: ['51.140.'], weight: 12 }, // United Kingdom
  { blocks: ['154.160.'], weight: 11 }, // Ghana
  { blocks: ['197.232.'], weight: 11 }, // Kenya
];

const DEVICE_UAS: Array<{ weight: number; uas: string[] }> = [
  {
    weight: 50,
    uas: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Safari/17.0',
    ],
  },
  {
    weight: 34,
    uas: [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36',
    ],
  },
  { weight: 16, uas: ['Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'] },
];

// Referrers grouped by channel (weights via repetition): organic heaviest, then direct, social, referral.
const REFERRERS: (string | null)[] = [
  'https://www.google.com/', 'https://www.google.com/', 'https://www.google.com/', 'https://www.bing.com/', 'https://duckduckgo.com/',
  null, null, null,
  'https://www.facebook.com/', 'https://t.co/', 'https://www.linkedin.com/', 'https://wa.me/',
  'https://news.example.ng/', 'https://partnerblog.example.com/',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function weightedIndex(weights: number[]): number {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    if ((r -= weights[i]) <= 0) return i;
  }
  return weights.length - 1;
}

export async function seedAnalytics(): Promise<{ events: number; posts: number }> {
  const db = await getDb();
  const posts = (await db.collection('posts').find({}, { projection: { _id: 1 } }).toArray()) as Array<{ _id: unknown }>;
  if (posts.length === 0) {
    console.log('Seed analytics: no posts found — seed posts first, then re-run.');
    return { events: 0, posts: 0 };
  }

  const pageViews = db.collection('page_views');
  // Idempotent: clear only our own demo events, never real traffic.
  await pageViews.deleteMany({ _demo: true });

  const now = Date.now();
  // Post popularity (front of the list = most popular) so the "top posts" ranking is stable.
  const postWeights = posts.map((_, i) => posts.length - i + Math.random() * 2);
  // Day weights rise toward the present → an upward traffic trend.
  const dayWeights = Array.from({ length: DAYS }, (_, d) => 0.7 + (d / DAYS) * 0.6);

  const depthValues = VISIT_DEPTH.map(([v]) => v);
  const depthWeights = VISIT_DEPTH.map(([, w]) => w);
  const countryWeights = COUNTRIES.map((c) => c.weight);
  const deviceWeights = DEVICE_UAS.map((d) => d.weight);

  const events: Document[] = [];
  const perPost = new Map<string, number>();

  for (let n = 0; n < NUM_VISITORS; n++) {
    const country = COUNTRIES[weightedIndex(countryWeights)];
    // Encode n into the octets so every visitor gets a distinct, stable IP within its block.
    const ip = `${pick(country.blocks)}${(n % 254) + 1}.${(Math.floor(n / 254) % 254) + 1}`;
    const ua = pick(DEVICE_UAS[weightedIndex(deviceWeights)].uas);
    const pages = depthValues[weightedIndex(depthWeights)];

    for (let k = 0; k < pages; k++) {
      const dayIdx = weightedIndex(dayWeights); // 0 = oldest
      const viewedAt = new Date(now - ((DAYS - 1 - dayIdx) * 24 + Math.floor(Math.random() * 24)) * 3600 * 1000);
      const post = posts[weightedIndex(postWeights)];
      events.push({
        postId: post._id,
        ip,
        userAgent: ua,
        referrer: pick(REFERRERS),
        dwellSec: Math.floor(45 + Math.random() * 315), // ~0.75–6 min on page
        viewedAt,
        _demo: true,
      });
      perPost.set(String(post._id), (perPost.get(String(post._id)) ?? 0) + 1);
    }
  }

  // Insert in chunks to keep payloads modest.
  for (let i = 0; i < events.length; i += 1000) {
    await pageViews.insertMany(events.slice(i, i + 1000));
  }

  // Sync posts.viewCount to their demo view totals.
  for (const [id, count] of perPost) {
    await db.collection('posts').updateOne({ _id: new ObjectId(id) }, { $set: { viewCount: count } });
  }

  console.log(`Seed analytics: ${events.length} page_views from ${NUM_VISITORS} visitors across ${perPost.size} posts (last ${DAYS} days).`);
  return { events: events.length, posts: perPost.size };
}

if (require.main === module) {
  seedAnalytics()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
