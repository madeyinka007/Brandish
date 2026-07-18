// isCategoryInUse delegates to the Post model (the Posts module wired this up, replacing the
// earlier 501 stub). Mock the model factory so no real connection is made.
jest.mock('../../lib/mongoose', () => ({ dbConnect: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/models/Post', () => ({ getPostModel: jest.fn() }));

import { getPostModel } from '../../lib/models/Post';
import { isCategoryInUse } from '../../lib/categoryUsage';

beforeEach(() => jest.clearAllMocks());

test('delegates to PostModel.exists with the category slug', async () => {
  const model = { exists: jest.fn().mockResolvedValue(true) };
  (getPostModel as jest.Mock).mockResolvedValue(model);

  await expect(isCategoryInUse('money')).resolves.toBe(true);
  expect(model.exists).toHaveBeenCalledWith({ category: 'money' });
});

test('returns false when no post references the slug', async () => {
  const model = { exists: jest.fn().mockResolvedValue(false) };
  (getPostModel as jest.Mock).mockResolvedValue(model);

  await expect(isCategoryInUse('unused')).resolves.toBe(false);
});
