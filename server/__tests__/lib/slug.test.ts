// slug.ts now imports the Post model (for uniqueSlug), whose chain connects at import — mock
// lib/mongoose and the model factory so even the pure slugify tests make no real connection.
jest.mock('../../lib/mongoose', () => ({ dbConnect: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/models/Post', () => ({ getPostModel: jest.fn() }));

import { getPostModel } from '../../lib/models/Post';
import { slugify, uniqueSlug } from '../../lib/slug';

describe('slugify', () => {
  test.each([
    ['Public Relations', 'public-relations'],
    ['  Trimmed  ', 'trimmed'],
    ['FMCG', 'fmcg'],
    ['Tech & Media!', 'tech-media'],           // punctuation dropped, spaces → hyphens
    ['multiple   spaces', 'multiple-spaces'],  // collapsed
    ['already-hyphenated', 'already-hyphenated'],
    ['--edges--', 'edges'],                    // leading/trailing hyphens trimmed
    ['café münchen', 'caf-mnchen'],            // non-ascii letters dropped
    ['!!!', ''],                               // punctuation-only → empty (caller rejects)
  ])('slugify(%p) === %p', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe('uniqueSlug', () => {
  let model: { exists: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    model = { exists: jest.fn().mockResolvedValue(false) };
    (getPostModel as jest.Mock).mockResolvedValue(model);
  });

  test('returns the base slug when it is unused', async () => {
    await expect(uniqueSlug('My Post')).resolves.toBe('my-post');
  });

  test('appends a numeric suffix on collision', async () => {
    // 'my-post' taken, 'my-post-2' free.
    model.exists.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(uniqueSlug('My Post')).resolves.toBe('my-post-2');
  });

  test('excludes the given id so a post never collides with its own current slug', async () => {
    await uniqueSlug('My Post', 'p1');
    expect(model.exists).toHaveBeenCalledWith({ slug: 'my-post', _id: { $ne: 'p1' } });
  });

  test('returns empty string when the title has no slug-able characters (caller rejects)', async () => {
    await expect(uniqueSlug('!!!')).resolves.toBe('');
    expect(model.exists).not.toHaveBeenCalled();
  });
});
