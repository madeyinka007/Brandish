import { ObjectId, type Document } from 'mongodb';
import { getDb } from '../lib/mongodb';

// ⚠ Native-driver module — `page_views` (and `analytics`) are native-driver-only collections
// (see the ODM split in docs/data-model.md), so this service talks to getDb() directly: no
// Mongoose model, no BaseModel.
//
// The admin analytics dashboard reads the raw `page_views` event log and derives every panel
// in-process. At Brandish's current scale (M0, one Lambda) reading a period's events per
// request is fine; the pre-aggregated `analytics` daily-rollup collection exists for when this
// needs to scale — swap the in-memory reductions below for rollup lookups then.

const COLLECTION = 'page_views';
const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;
const TOP_POSTS = 6;
const TOP_COUNTRIES = 5;

export interface Metric {
  value: number;
  deltaPct: number; // vs the immediately-preceding period of equal length
}
export interface AnalyticsOverview {
  rangeDays: number;
  range: { start: string; end: string };
  summary: {
    totalViews: Metric;
    uniqueVisitors: Metric;
    avgTimeOnPageSec: Metric;
    bounceRatePct: Metric;
  };
  timeseries: Array<{ date: string; views: number; unique: number }>;
  sources: Array<{ source: string; sessions: number; pct: number }>;
  devices: Array<{ device: string; sessions: number; pct: number }>;
  topPosts: Array<{
    postId: string;
    title: string;
    category: string;
    slug: string;
    views: number;
    avgTimeSec: number;
    bounceRatePct: number;
    changePct: number;
  }>;
  topCountries: Array<{ country: string; code: string; sessions: number; pct: number }>;
}

interface ViewEvent {
  postId: unknown;
  ip?: string;
  userAgent?: string;
  referrer?: string | null;
  dwellSec?: number;
  viewedAt: Date;
}

// ---- classifiers (pure) ----

/** Bucket a referrer into the four channels the dashboard reports. */
export function classifySource(referrer?: string | null): 'Organic search' | 'Direct' | 'Social' | 'Referral' {
  if (!referrer) return 'Direct';
  const r = referrer.toLowerCase();
  if (/google\.|bing\.|duckduckgo\.|yahoo\.|ecosia\.|search\?/.test(r)) return 'Organic search';
  if (/facebook\.|fb\.|twitter\.|x\.com|t\.co|linkedin\.|instagram\.|whatsapp|wa\.me|tiktok\.|reddit\.|youtube\./.test(r)) return 'Social';
  return 'Referral';
}

/** Coarse device class from a User-Agent string. */
export function classifyDevice(ua?: string): 'Desktop' | 'Mobile' | 'Tablet' {
  const s = (ua ?? '').toLowerCase();
  if (/ipad|tablet|playbook|silk|kindle/.test(s)) return 'Tablet';
  if (/mobi|iphone|ipod|android.*mobile|windows phone/.test(s)) return 'Mobile';
  return 'Desktop';
}

/**
 * Country from IP. This is a deliberate stub keyed to the demo IP blocks — a production build
 * swaps it for a real geo-IP lookup (MaxMind GeoLite2 / ipinfo). Kept pure + exported so the
 * seed and the aggregation agree, and so it's unit-testable.
 */
export function geoFromIp(ip?: string): { country: string; code: string } {
  const blocks: Array<[string, string, string]> = [
    ['102.89.', 'Nigeria', 'NG'],
    ['105.112.', 'Nigeria', 'NG'],
    ['197.210.', 'Nigeria', 'NG'],
    ['12.34.', 'United States', 'US'],
    ['23.62.', 'United States', 'US'],
    ['51.140.', 'United Kingdom', 'GB'],
    ['154.160.', 'Ghana', 'GH'],
    ['197.232.', 'Kenya', 'KE'],
  ];
  const hit = ip ? blocks.find(([prefix]) => ip.startsWith(prefix)) : undefined;
  return hit ? { country: hit[1], code: hit[2] } : { country: 'Other', code: 'ZZ' };
}

// ---- helpers ----

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}
function deltaPct(current: number, previous: number): number {
  if (previous > 0) return Math.round(((current - previous) / previous) * 1000) / 10;
  return current > 0 ? 100 : 0;
}
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface Totals {
  views: number;
  unique: number;
  avgTime: number;
  bounceRate: number;
}
function summarize(docs: ViewEvent[]): Totals {
  const views = docs.length;
  const perIp = new Map<string, number>();
  let dwell = 0;
  for (const d of docs) {
    const ip = d.ip ?? '';
    perIp.set(ip, (perIp.get(ip) ?? 0) + 1);
    dwell += d.dwellSec ?? 0;
  }
  const unique = perIp.size;
  let bounced = 0;
  for (const c of perIp.values()) if (c === 1) bounced++;
  return {
    views,
    unique,
    avgTime: views ? Math.round(dwell / views) : 0,
    bounceRate: unique ? Math.round((bounced / unique) * 1000) / 10 : 0,
  };
}

export async function getAnalytics(days: number = DEFAULT_DAYS): Promise<AnalyticsOverview> {
  const rangeDays = Math.min(Math.max(1, Math.floor(days) || DEFAULT_DAYS), MAX_DAYS);
  const db = await getDb();
  const col = db.collection(COLLECTION);

  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (rangeDays - 1));
  const prevStart = new Date(start);
  prevStart.setUTCDate(prevStart.getUTCDate() - rangeDays);

  const projection = { _id: 0, postId: 1, ip: 1, userAgent: 1, referrer: 1, dwellSec: 1, viewedAt: 1 };
  const [current, previous] = (await Promise.all([
    col.find({ viewedAt: { $gte: start, $lte: now } }, { projection }).toArray(),
    col.find({ viewedAt: { $gte: prevStart, $lt: start } }, { projection }).toArray(),
  ])) as unknown as [ViewEvent[], ViewEvent[]];

  const cur = summarize(current);
  const prev = summarize(previous);

  // ---- timeseries (fill every day in the window, even zero-view days) ----
  const byDay = new Map<string, { views: number; ips: Set<string> }>();
  for (const d of current) {
    const key = dayKey(new Date(d.viewedAt));
    const bucket = byDay.get(key) ?? { views: 0, ips: new Set<string>() };
    bucket.views += 1;
    bucket.ips.add(d.ip ?? '');
    byDay.set(key, bucket);
  }
  const timeseries: AnalyticsOverview['timeseries'] = [];
  for (let i = 0; i < rangeDays; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const key = dayKey(d);
    const bucket = byDay.get(key);
    timeseries.push({ date: key, views: bucket?.views ?? 0, unique: bucket?.ips.size ?? 0 });
  }

  // ---- sources ----
  const srcTally = new Map<string, number>();
  for (const d of current) srcTally.set(classifySource(d.referrer), (srcTally.get(classifySource(d.referrer)) ?? 0) + 1);
  const sources = [...srcTally.entries()]
    .map(([source, sessions]) => ({ source, sessions, pct: pct(sessions, cur.views) }))
    .sort((a, b) => b.sessions - a.sessions);

  // ---- devices (fixed order) ----
  const devTally = new Map<string, number>();
  for (const d of current) devTally.set(classifyDevice(d.userAgent), (devTally.get(classifyDevice(d.userAgent)) ?? 0) + 1);
  const devices = (['Desktop', 'Mobile', 'Tablet'] as const)
    .map((device) => ({ device, sessions: devTally.get(device) ?? 0, pct: pct(devTally.get(device) ?? 0, cur.views) }))
    .filter((d) => d.sessions > 0 || cur.views === 0);

  // ---- countries ----
  const geoTally = new Map<string, { country: string; code: string; sessions: number }>();
  for (const d of current) {
    const g = geoFromIp(d.ip);
    const entry = geoTally.get(g.code) ?? { ...g, sessions: 0 };
    entry.sessions += 1;
    geoTally.set(g.code, entry);
  }
  const topCountries = [...geoTally.values()]
    .map((e) => ({ ...e, pct: pct(e.sessions, cur.views) }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, TOP_COUNTRIES);

  // ---- top posts (with per-post change vs previous period) ----
  const perPost = new Map<string, { views: number; dwell: number; ipCounts: Map<string, number> }>();
  for (const d of current) {
    const id = String(d.postId);
    const p = perPost.get(id) ?? { views: 0, dwell: 0, ipCounts: new Map<string, number>() };
    p.views += 1;
    p.dwell += d.dwellSec ?? 0;
    p.ipCounts.set(d.ip ?? '', (p.ipCounts.get(d.ip ?? '') ?? 0) + 1);
    perPost.set(id, p);
  }
  const prevPerPost = new Map<string, number>();
  for (const d of previous) {
    const id = String(d.postId);
    prevPerPost.set(id, (prevPerPost.get(id) ?? 0) + 1);
  }
  const rankedIds = [...perPost.entries()].sort((a, b) => b[1].views - a[1].views).slice(0, TOP_POSTS).map(([id]) => id);

  const postDocs = rankedIds.length
    ? ((await db
        .collection('posts')
        .find({ _id: { $in: rankedIds.map((id) => new ObjectId(id)) } }, { projection: { title: 1, category: 1, slug: 1 } })
        .toArray()) as Document[])
    : [];
  const postMap = new Map(postDocs.map((p) => [String(p._id), p]));

  const topPosts: AnalyticsOverview['topPosts'] = rankedIds.map((id) => {
    const p = perPost.get(id)!;
    let bounced = 0;
    for (const c of p.ipCounts.values()) if (c === 1) bounced++;
    const doc = postMap.get(id);
    return {
      postId: id,
      title: (doc?.title as string) ?? 'Untitled post',
      category: (doc?.category as string) ?? '',
      slug: (doc?.slug as string) ?? '',
      views: p.views,
      avgTimeSec: p.views ? Math.round(p.dwell / p.views) : 0,
      bounceRatePct: p.ipCounts.size ? Math.round((bounced / p.ipCounts.size) * 1000) / 10 : 0,
      changePct: deltaPct(p.views, prevPerPost.get(id) ?? 0),
    };
  });

  return {
    rangeDays,
    range: { start: start.toISOString(), end: now.toISOString() },
    summary: {
      totalViews: { value: cur.views, deltaPct: deltaPct(cur.views, prev.views) },
      uniqueVisitors: { value: cur.unique, deltaPct: deltaPct(cur.unique, prev.unique) },
      avgTimeOnPageSec: { value: cur.avgTime, deltaPct: deltaPct(cur.avgTime, prev.avgTime) },
      bounceRatePct: { value: cur.bounceRate, deltaPct: deltaPct(cur.bounceRate, prev.bounceRate) },
    },
    timeseries,
    sources,
    devices,
    topPosts,
    topCountries,
  };
}
