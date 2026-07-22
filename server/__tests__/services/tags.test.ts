jest.mock('../../lib/mongoose', () => ({ dbConnect: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/models/Tag', () => {
  const actual = jest.requireActual('../../lib/models/Tag');
  return { ...actual, getTagModel: jest.fn() };
});
jest.mock('../../lib/models/Post', () => ({ getPostModel: jest.fn() }));

import { getTagModel } from '../../lib/models/Tag';
import { getPostModel } from '../../lib/models/Post';
import * as tags from '../../services/tags';

let model: { find: jest.Mock; exists: jest.Mock; create: jest.Mock; updateById: jest.Mock; delete: jest.Mock };
let postModel: { aggregate: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  model = {
    find: jest.fn(),
    exists: jest.fn().mockResolvedValue(false),
    create: jest.fn(),
    updateById: jest.fn(),
    delete: jest.fn(),
  };
  postModel = { aggregate: jest.fn().mockResolvedValue([]) };
  (getTagModel as jest.Mock).mockResolvedValue(model);
  (getPostModel as jest.Mock).mockResolvedValue(postModel);
});

describe('listTags', () => {
  test('lists all tags sorted by name', async () => {
    model.find.mockResolvedValue([{ slug: 'fintech' }]);
    const result = await tags.listTags();
    expect(model.find).toHaveBeenCalledWith({}, expect.objectContaining({ sort: 'name' }));
    expect(result).toEqual([{ slug: 'fintech' }]);
  });
});

describe('createTag', () => {
  test('generates a slug from the name and creates with description/color defaults', async () => {
    model.create.mockResolvedValue({ _id: 't1', name: 'Fintech', slug: 'fintech' });

    const result = await tags.createTag({ name: 'Fintech' });

    expect(model.create).toHaveBeenCalledWith({ name: 'Fintech', slug: 'fintech', description: '', color: '' });
    expect(result).toMatchObject({ slug: 'fintech' });
  });

  test('passes through description and color', async () => {
    model.create.mockResolvedValue({ _id: 't1' });
    await tags.createTag({ name: 'Fintech', description: 'money tech', color: '#6366f1' });
    expect(model.create).toHaveBeenCalledWith({ name: 'Fintech', slug: 'fintech', description: 'money tech', color: '#6366f1' });
  });

  test('409 TAG_EXISTS when the slug already exists (pre-check) — no create', async () => {
    model.exists.mockResolvedValue(true);
    await expect(tags.createTag({ name: 'Fintech' })).rejects.toMatchObject({ statusCode: 409, code: 'TAG_EXISTS' });
    expect(model.create).not.toHaveBeenCalled();
  });

  test('409 TAG_EXISTS on the unique-index race (E11000)', async () => {
    model.exists.mockResolvedValue(false);
    model.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
    await expect(tags.createTag({ name: 'Fintech' })).rejects.toMatchObject({ statusCode: 409, code: 'TAG_EXISTS' });
  });

  test('400 when the name is missing', async () => {
    await expect(tags.createTag({ name: '' })).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_TAG_INPUT' });
    await expect(tags.createTag({ name: undefined })).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_TAG_INPUT' });
  });

  test('400 when the name slugifies to empty (punctuation only)', async () => {
    await expect(tags.createTag({ name: '!!!' })).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_TAG_INPUT' });
  });
});

describe('listTagsWithUsage', () => {
  test('merges per-tag post counts from the posts.tags aggregation (0 when unused)', async () => {
    model.find.mockResolvedValue([
      { slug: 'fintech', name: 'Fintech' },
      { slug: 'unused', name: 'Unused' },
    ]);
    postModel.aggregate.mockResolvedValue([{ _id: 'fintech', count: 3 }]);

    const result = await tags.listTagsWithUsage();

    expect(postModel.aggregate).toHaveBeenCalledWith([
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
    ]);
    expect(result).toEqual([
      { slug: 'fintech', name: 'Fintech', postCount: 3 },
      { slug: 'unused', name: 'Unused', postCount: 0 },
    ]);
  });
});

describe('updateTag', () => {
  test('applies name/description/color and NEVER the slug', async () => {
    model.updateById.mockResolvedValue({ _id: 't1' });
    await tags.updateTag('t1', { name: 'Renamed', description: 'd', color: '#000', slug: 'hacked' });
    const update = model.updateById.mock.calls[0][1];
    expect(update).toEqual({ name: 'Renamed', description: 'd', color: '#000' });
    expect(update).not.toHaveProperty('slug');
  });

  test('404 when the tag does not exist', async () => {
    model.updateById.mockResolvedValue(null);
    await expect(tags.updateTag('ghost', { name: 'X' })).rejects.toMatchObject({ statusCode: 404, code: 'TAG_NOT_FOUND' });
  });

  test('400 when name is provided but empty', async () => {
    await expect(tags.updateTag('t1', { name: '' })).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_TAG_INPUT' });
    expect(model.updateById).not.toHaveBeenCalled();
  });
});

describe('deleteTag', () => {
  test('deletes and resolves (no cascade to posts.tags)', async () => {
    model.delete.mockResolvedValue({ _id: 't1' });
    await expect(tags.deleteTag('t1')).resolves.toBeUndefined();
    expect(model.delete).toHaveBeenCalledWith('t1');
  });

  test('404 when nothing was deleted', async () => {
    model.delete.mockResolvedValue(null);
    await expect(tags.deleteTag('ghost')).rejects.toMatchObject({ statusCode: 404, code: 'TAG_NOT_FOUND' });
  });
});
