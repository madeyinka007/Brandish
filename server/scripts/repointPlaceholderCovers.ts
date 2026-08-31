import 'dotenv/config';
import { getDb } from '../lib/mongodb';

/**
 * One-off repair: repoint dead picsum.photos placeholder covers at the current placeholder
 * host. picsum went down and, because a hung upstream makes next/image time out rather than
 * fail fast, every cover on the live site rendered as an empty box.
 *
 * Deliberately NOT part of seedPosts.ts. That script rewrites `excerpt` and `body` on EVERY
 * post — real editorial content included — so it is not safe to re-run just to fix images.
 * This touches `coverImage`/`ogImage` and nothing else, and only on documents still pointing
 * at picsum, so it is idempotent and safe to re-run.
 *
 * Run:  npm run fix:covers        (add --dry to preview without writing)
 */
const PICSUM = /picsum\.photos/;

const coverLock = (slug: string): number => {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return (h % 100000) + 1;
};
const topic = (category?: string): string =>
  (category ?? 'business').toLowerCase().replace(/[^a-z]+/g, ',').replace(/^,|,$/g, '') || 'business';
const cover = (slug: string, category?: string) =>
  `https://loremflickr.com/1200/675/${topic(category)}?lock=${coverLock(slug)}`;

(async () => {
  const dry = process.argv.includes('--dry');
  const db = await getDb();
  const posts = db.collection('posts');

  const stale = await posts
    .find({ $or: [{ coverImage: PICSUM }, { ogImage: PICSUM }] })
    .project({ _id: 1, slug: 1, category: 1, seedDemo: 1, coverImage: 1, ogImage: 1 })
    .toArray();

  let demo = 0;
  let real = 0;
  for (const p of stale) {
    const next = cover(String(p.slug), p.category ? String(p.category) : undefined);
    const set: Record<string, string> = {};
    if (PICSUM.test(String(p.coverImage ?? ''))) set.coverImage = next;
    if (PICSUM.test(String(p.ogImage ?? ''))) set.ogImage = next;
    if (!Object.keys(set).length) continue;
    if (!dry) await posts.updateOne({ _id: p._id }, { $set: set });
    if (p.seedDemo === true) demo++;
    else real++;
  }

  console.log(
    `${dry ? '[dry run] would update' : 'updated'} ${demo + real} post(s) — ${demo} demo, ${real} real editorial.`,
  );
  if (real > 0) {
    console.log(
      `NOTE: ${real} real post(s) now carry a PLACEHOLDER cover. Replace them with proper art from the media library.`,
    );
  }
  process.exit(0);
})().catch((e) => {
  console.error('failed:', e.message);
  process.exit(1);
});
