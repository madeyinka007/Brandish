// Factory mock so lib/mongodb.ts never opens a real connection.
jest.mock('../../lib/mongodb', () => ({ getDb: jest.fn() }));
jest.mock('mongodb', () => ({
  ObjectId: jest.fn().mockImplementation((id?: string) => ({ __oid: id, toString: () => id })),
}));

import { getDb } from '../../lib/mongodb';
import { getAnalytics, classifySource, classifyDevice, geoFromIp } from '../../services/analytics';

const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0 Safari/537.36';
const MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5) Mobile/15E148';
const TABLET = 'Mozilla/5.0 (iPad; CPU OS 17_5) Mobile/15E148';

describe('pure classifiers', () => {
  test('classifySource buckets referrers', () => {
    expect(classifySource('https://www.google.com/search?q=x')).toBe('Organic search');
    expect(classifySource(null)).toBe('Direct');
    expect(classifySource('')).toBe('Direct');
    expect(classifySource('https://www.facebook.com/')).toBe('Social');
    expect(classifySource('https://t.co/abc')).toBe('Social');
    expect(classifySource('https://randomblog.example.com/')).toBe('Referral');
  });

  test('classifyDevice reads the UA', () => {
    expect(classifyDevice(DESKTOP)).toBe('Desktop');
    expect(classifyDevice(MOBILE)).toBe('Mobile');
    expect(classifyDevice(TABLET)).toBe('Tablet');
    expect(classifyDevice(undefined)).toBe('Desktop');
  });

  test('geoFromIp maps known blocks, else Other', () => {
    expect(geoFromIp('102.89.1.2')).toEqual({ country: 'Nigeria', code: 'NG' });
    expect(geoFromIp('12.34.5.6')).toEqual({ country: 'United States', code: 'US' });
    expect(geoFromIp('51.140.2.3')).toEqual({ country: 'United Kingdom', code: 'GB' });
    expect(geoFromIp('8.8.8.8')).toEqual({ country: 'Other', code: 'ZZ' });
    expect(geoFromIp(undefined)).toEqual({ country: 'Other', code: 'ZZ' });
  });
});

function mockDb(current: any[], previous: any[], postDocs: any[]) {
  const pv = { find: jest.fn() };
  pv.find
    .mockReturnValueOnce({ toArray: () => Promise.resolve(current) })
    .mockReturnValueOnce({ toArray: () => Promise.resolve(previous) });
  const postsCol = { find: jest.fn().mockReturnValue({ toArray: () => Promise.resolve(postDocs) }) };
  const db = { collection: jest.fn((name: string) => (name === 'page_views' ? pv : postsCol)) };
  (getDb as jest.Mock).mockResolvedValue(db);
}

beforeEach(() => jest.clearAllMocks());

describe('getAnalytics', () => {
  const now = new Date();
  const current = [
    { postId: 'p1', ip: '102.89.1.1', userAgent: DESKTOP, referrer: 'https://www.google.com/', dwellSec: 120, viewedAt: now },
    { postId: 'p1', ip: '12.34.1.1', userAgent: MOBILE, referrer: null, dwellSec: 60, viewedAt: now },
    { postId: 'p2', ip: '51.140.1.1', userAgent: TABLET, referrer: 'https://www.facebook.com/', dwellSec: 180, viewedAt: now },
  ];
  const previous = [
    { postId: 'p1', ip: '9.9.9.9', userAgent: DESKTOP, referrer: null, dwellSec: 10, viewedAt: new Date(now.getTime() - 40 * 864e5) },
  ];
  const postDocs = [
    { _id: 'p1', title: 'Post One', category: 'technology', slug: 'post-one' },
    { _id: 'p2', title: 'Post Two', category: 'money', slug: 'post-two' },
  ];

  test('summary metrics + deltas vs previous period', async () => {
    mockDb(current, previous, postDocs);
    const a = await getAnalytics(30);

    expect(a.rangeDays).toBe(30);
    expect(a.summary.totalViews).toEqual({ value: 3, deltaPct: 200 }); // (3-1)/1
    expect(a.summary.uniqueVisitors.value).toBe(3); // 3 distinct ips
    expect(a.summary.avgTimeOnPageSec.value).toBe(120); // (120+60+180)/3
    expect(a.summary.bounceRatePct.value).toBe(100); // every ip has exactly one view
  });

  test('sources, devices and countries tally the period', async () => {
    mockDb(current, previous, postDocs);
    const a = await getAnalytics(30);

    expect(a.sources.map((s) => s.source).sort()).toEqual(['Direct', 'Organic search', 'Social']);
    expect(a.devices).toEqual([
      { device: 'Desktop', sessions: 1, pct: 33.3 },
      { device: 'Mobile', sessions: 1, pct: 33.3 },
      { device: 'Tablet', sessions: 1, pct: 33.3 },
    ]);
    const codes = a.topCountries.map((c) => c.code).sort();
    expect(codes).toEqual(['GB', 'NG', 'US']);
  });

  test('top posts ranked by views, joined to titles, with change%', async () => {
    mockDb(current, previous, postDocs);
    const a = await getAnalytics(30);

    expect(a.topPosts[0]).toMatchObject({ postId: 'p1', title: 'Post One', category: 'technology', views: 2, changePct: 100 });
    expect(a.topPosts[1]).toMatchObject({ postId: 'p2', title: 'Post Two', views: 1 });
  });

  test('timeseries spans the full window and sums to total views', async () => {
    mockDb(current, previous, postDocs);
    const a = await getAnalytics(30);

    expect(a.timeseries).toHaveLength(30);
    expect(a.timeseries.reduce((s, d) => s + d.views, 0)).toBe(3);
  });

  test('empty data yields zeros, not a throw', async () => {
    mockDb([], [], []);
    const a = await getAnalytics(30);

    expect(a.summary.totalViews).toEqual({ value: 0, deltaPct: 0 });
    expect(a.topPosts).toEqual([]);
    expect(a.topCountries).toEqual([]);
    expect(a.timeseries).toHaveLength(30);
  });

  test('clamps the day range', async () => {
    mockDb([], [], []);
    expect((await getAnalytics(0)).rangeDays).toBe(30); // 0 → default
    mockDb([], [], []);
    expect((await getAnalytics(9999)).rangeDays).toBe(365); // capped
  });
});
