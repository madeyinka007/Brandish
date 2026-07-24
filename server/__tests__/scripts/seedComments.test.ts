// Factory mock so lib/mongodb.ts (opens a Mongo connection at import) never loads.
jest.mock('../../lib/mongodb', () => ({ getDb: jest.fn() }));

import { getDb } from '../../lib/mongodb';
import { seedComments } from '../../scripts/seedComments';

function makeDb(opts: { posts: any[]; existing?: Set<string> }) {
  const existing = opts.existing ?? new Set<string>();
  const comments = {
    findOne: jest.fn(({ authorEmail }: { authorEmail: string }) =>
      Promise.resolve(existing.has(authorEmail) ? { _id: 'x' } : null),
    ),
    insertOne: jest.fn().mockResolvedValue({ insertedId: 'new' }),
  };
  const db = {
    collection: jest.fn((name: string) => {
      if (name === 'posts') {
        return {
          find: () => ({ limit: () => ({ toArray: () => Promise.resolve(opts.posts) }) }),
        };
      }
      return comments;
    }),
  };
  return { db, comments };
}

beforeEach(() => jest.clearAllMocks());

describe('seedComments', () => {
  test('does nothing when there are no posts to attach to', async () => {
    const { db, comments } = makeDb({ posts: [] });
    (getDb as jest.Mock).mockResolvedValue(db);

    const result = await seedComments();

    expect(result).toEqual({ created: 0, skipped: 0 });
    expect(comments.insertOne).not.toHaveBeenCalled();
  });

  test('inserts every demo comment when none exist, distributed across posts', async () => {
    const posts = [{ _id: 'p1' }, { _id: 'p2' }, { _id: 'p3' }];
    const { db, comments } = makeDb({ posts });
    (getDb as jest.Mock).mockResolvedValue(db);

    const result = await seedComments();

    expect(result.skipped).toBe(0);
    expect(result.created).toBeGreaterThan(0);
    expect(comments.insertOne).toHaveBeenCalledTimes(result.created);

    const first = comments.insertOne.mock.calls[0][0];
    expect(first).toMatchObject({ status: expect.any(String), authorEmail: expect.any(String) });
    expect(first.createdAt).toBeInstanceOf(Date);
    // postId cycles through the available posts
    expect(posts.map((p) => p._id)).toContain(first.postId);
  });

  test('is idempotent — skips demo comments already present by email', async () => {
    const posts = [{ _id: 'p1' }];
    const seenEmail = 'chinedu.okafor@example.com';
    const { db, comments } = makeDb({ posts, existing: new Set([seenEmail]) });
    (getDb as jest.Mock).mockResolvedValue(db);

    const result = await seedComments();

    expect(result.skipped).toBe(1);
    // the pre-existing one is never re-inserted
    expect(comments.insertOne.mock.calls.every((call) => call[0].authorEmail !== seenEmail)).toBe(true);
  });
});
