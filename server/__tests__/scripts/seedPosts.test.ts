jest.mock('../../lib/mongodb', () => ({ getDb: jest.fn() }));
jest.mock('mongodb', () => ({ ObjectId: class {} }));

import { getDb } from '../../lib/mongodb';
import { seedPosts } from '../../scripts/seedPosts';

function makeDb(authors: any[], existing: any[]) {
  const posts = {
    find: jest.fn(() => ({ toArray: () => Promise.resolve(existing) })),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    insertMany: jest.fn().mockResolvedValue({ insertedCount: 0 }),
    countDocuments: jest.fn().mockResolvedValue(100),
  };
  const users = { find: jest.fn(() => ({ toArray: () => Promise.resolve(authors) })) };
  const db = { collection: jest.fn((name: string) => (name === 'users' ? users : posts)) };
  return { db, posts };
}

beforeEach(() => jest.clearAllMocks());

describe('seedPosts', () => {
  test('no content-role users → does nothing', async () => {
    const { db, posts } = makeDb([], []);
    (getDb as jest.Mock).mockResolvedValue(db);
    const result = await seedPosts();
    expect(result).toEqual({ updated: 0, created: 0, total: 0 });
    expect(posts.insertMany).not.toHaveBeenCalled();
  });

  test('enriches existing posts and tops up to 100', async () => {
    const authors = [{ _id: 'a1', name: 'Ada', avatar: '' }];
    const existing = Array.from({ length: 10 }, (_, i) => ({
      _id: `p${i}`,
      title: `Real Post ${i}`,
      slug: `real-post-${i}`,
      category: 'money',
    }));
    const { db, posts } = makeDb(authors, existing);
    (getDb as jest.Mock).mockResolvedValue(db);

    const result = await seedPosts();

    // every existing post enriched (excerpt/body/cover), demo cleared, 90 created
    expect(posts.updateOne).toHaveBeenCalledTimes(10);
    const firstUpdate = posts.updateOne.mock.calls[0][1].$set;
    expect(firstUpdate.coverImage).toContain('picsum.photos');
    expect(firstUpdate.body.type).toBe('doc');
    expect(firstUpdate.excerpt.length).toBeGreaterThan(80);

    expect(posts.deleteMany).toHaveBeenCalledWith({ seedDemo: true });
    expect(result.updated).toBe(10);
    expect(result.created).toBe(90);

    const inserted = posts.insertMany.mock.calls.flatMap((c) => c[0]);
    expect(inserted).toHaveLength(90);
    expect(inserted[0]).toMatchObject({ status: 'published', seedDemo: true, category: expect.any(String) });
    expect(inserted[0].coverImage).toContain('picsum.photos');
    expect(inserted[0].publishedAt).toBeInstanceOf(Date);
    // spread across all ten categories
    expect(new Set(inserted.map((d: any) => d.category)).size).toBe(10);
  });
});
