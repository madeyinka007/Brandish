jest.mock('../../lib/mongoose', () => ({ dbConnect: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/models/Tag', () => {
  const actual = jest.requireActual('../../lib/models/Tag');
  return { ...actual, getTagModel: jest.fn() };
});

import { getTagModel } from '../../lib/models/Tag';
import * as tags from '../../services/tags';

let model: { find: jest.Mock; exists: jest.Mock; create: jest.Mock; delete: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  model = {
    find: jest.fn(),
    exists: jest.fn().mockResolvedValue(false),
    create: jest.fn(),
    delete: jest.fn(),
  };
  (getTagModel as jest.Mock).mockResolvedValue(model);
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
  test('generates a slug from the name and creates', async () => {
    model.create.mockResolvedValue({ _id: 't1', name: 'Fintech', slug: 'fintech' });

    const result = await tags.createTag('Fintech');

    expect(model.create).toHaveBeenCalledWith({ name: 'Fintech', slug: 'fintech' });
    expect(result).toMatchObject({ slug: 'fintech' });
  });

  test('409 TAG_EXISTS when the slug already exists (pre-check) — no create', async () => {
    model.exists.mockResolvedValue(true);
    await expect(tags.createTag('Fintech')).rejects.toMatchObject({ statusCode: 409, code: 'TAG_EXISTS' });
    expect(model.create).not.toHaveBeenCalled();
  });

  test('409 TAG_EXISTS on the unique-index race (E11000)', async () => {
    model.exists.mockResolvedValue(false);
    model.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
    await expect(tags.createTag('Fintech')).rejects.toMatchObject({ statusCode: 409, code: 'TAG_EXISTS' });
  });

  test('400 when the name is missing', async () => {
    await expect(tags.createTag('')).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_TAG_INPUT' });
    await expect(tags.createTag(undefined)).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_TAG_INPUT' });
  });

  test('400 when the name slugifies to empty (punctuation only)', async () => {
    await expect(tags.createTag('!!!')).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_TAG_INPUT' });
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
