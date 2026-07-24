jest.mock('../../lib/mongodb', () => ({ getDb: jest.fn() }));
jest.mock('mongodb', () => ({
  ObjectId: jest.fn().mockImplementation((id?: string) => ({ __oid: id, toString: () => id })),
}));

import { getDb } from '../../lib/mongodb';
import { seedAnalytics } from '../../scripts/seedAnalytics';

function makeDb(posts: any[]) {
  const pageViews = {
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    insertMany: jest.fn().mockResolvedValue({ insertedCount: 0 }),
  };
  const postsCol = {
    find: jest.fn().mockReturnValue({ toArray: () => Promise.resolve(posts) }),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
  const db = { collection: jest.fn((name: string) => (name === 'page_views' ? pageViews : postsCol)) };
  return { db, pageViews, postsCol };
}

beforeEach(() => jest.clearAllMocks());

describe('seedAnalytics', () => {
  test('no posts → does nothing', async () => {
    const { db, pageViews } = makeDb([]);
    (getDb as jest.Mock).mockResolvedValue(db);

    const result = await seedAnalytics();

    expect(result).toEqual({ events: 0, posts: 0 });
    expect(pageViews.insertMany).not.toHaveBeenCalled();
  });

  test('clears its own demo events, inserts page_views, syncs viewCount', async () => {
    const posts = [{ _id: 'p1' }, { _id: 'p2' }, { _id: 'p3' }];
    const { db, pageViews, postsCol } = makeDb(posts);
    (getDb as jest.Mock).mockResolvedValue(db);

    const result = await seedAnalytics();

    // idempotent clear scoped to demo events only
    expect(pageViews.deleteMany).toHaveBeenCalledWith({ _demo: true });
    expect(result.events).toBeGreaterThan(0);
    expect(pageViews.insertMany).toHaveBeenCalled();

    // every inserted event carries the fields analytics reads + the demo marker
    const firstBatch = pageViews.insertMany.mock.calls[0][0];
    expect(firstBatch[0]).toMatchObject({
      _demo: true,
      ip: expect.any(String),
      userAgent: expect.any(String),
      dwellSec: expect.any(Number),
    });
    expect(firstBatch[0].viewedAt).toBeInstanceOf(Date);

    // viewCount synced for each post that received views
    expect(postsCol.updateOne).toHaveBeenCalled();
    expect(result.posts).toBeLessThanOrEqual(posts.length);
    expect(result.posts).toBeGreaterThan(0);
  });
});
