// lib/mongoose connects at import time — mock it so importing the Category model chain
// makes no real connection.
jest.mock('../../lib/mongoose', () => ({ dbConnect: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/models/Category', () => {
  const actual = jest.requireActual('../../lib/models/Category');
  return { ...actual, getCategoryModel: jest.fn() };
});
jest.mock('../../lib/categoryUsage');

import { getCategoryModel } from '../../lib/models/Category';
import { isCategoryInUse } from '../../lib/categoryUsage';
import * as categories from '../../services/categories';

let model: {
  find: jest.Mock;
  findById: jest.Mock;
  exists: jest.Mock;
  create: jest.Mock;
  updateById: jest.Mock;
  delete: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  model = {
    find: jest.fn(),
    findById: jest.fn(),
    exists: jest.fn().mockResolvedValue(false),
    create: jest.fn(),
    updateById: jest.fn(),
    delete: jest.fn(),
  };
  (getCategoryModel as jest.Mock).mockResolvedValue(model);
});

describe('listPublic / listAll', () => {
  test('listPublic filters to active and sorts by order then name', async () => {
    model.find.mockResolvedValue([{ slug: 'money' }]);
    await categories.listPublic();
    expect(model.find).toHaveBeenCalledWith({ status: 'active' }, expect.objectContaining({ sort: 'order name' }));
  });

  test('listAll passes no status filter', async () => {
    model.find.mockResolvedValue([]);
    await categories.listAll();
    expect(model.find).toHaveBeenCalledWith({}, expect.objectContaining({ sort: 'order name' }));
  });
});

describe('createCategory', () => {
  test('generates a slug from the name and creates', async () => {
    model.create.mockResolvedValue({ _id: 'c1', slug: 'public-relations' });

    const result = await categories.createCategory({ name: 'Public Relations' });

    const created = model.create.mock.calls[0][0];
    expect(created.slug).toBe('public-relations');
    expect(created.name).toBe('Public Relations');
    expect(created.status).toBe('active'); // default
    expect(result).toMatchObject({ slug: 'public-relations' });
  });

  test('409 NAME_EXISTS when the slug already exists (pre-check)', async () => {
    model.exists.mockResolvedValue(true);
    await expect(categories.createCategory({ name: 'Money' })).rejects.toMatchObject({ statusCode: 409, code: 'NAME_EXISTS' });
    expect(model.create).not.toHaveBeenCalled();
  });

  test('409 NAME_EXISTS on the unique-index race (E11000)', async () => {
    model.exists.mockResolvedValue(false);
    model.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
    await expect(categories.createCategory({ name: 'Money' })).rejects.toMatchObject({ statusCode: 409, code: 'NAME_EXISTS' });
  });

  test('400 when the name is missing', async () => {
    await expect(categories.createCategory({ name: '' })).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_CATEGORY_INPUT' });
  });

  test('400 when the name slugifies to empty (punctuation only)', async () => {
    await expect(categories.createCategory({ name: '!!!' })).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_CATEGORY_INPUT' });
  });

  test('400 for an invalid status', async () => {
    await expect(categories.createCategory({ name: 'X', status: 'archived' })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('updateCategory', () => {
  test('applies whitelisted fields', async () => {
    model.updateById.mockResolvedValue({ _id: 'c1' });
    await categories.updateCategory('c1', { name: 'New Name', color: '#fff', order: 3, status: 'hidden' });
    expect(model.updateById).toHaveBeenCalledWith('c1', { name: 'New Name', color: '#fff', order: 3, status: 'hidden' });
  });

  test('NEVER updates the slug, even when slug (and name) are in the payload', async () => {
    model.updateById.mockResolvedValue({ _id: 'c1' });
    await categories.updateCategory('c1', { name: 'Renamed', slug: 'hacked-slug' });
    const update = model.updateById.mock.calls[0][1];
    expect(update).not.toHaveProperty('slug');
    expect(update).toEqual({ name: 'Renamed' });
  });

  test('404 when the category does not exist', async () => {
    model.updateById.mockResolvedValue(null);
    await expect(categories.updateCategory('ghost', { name: 'X' })).rejects.toMatchObject({ statusCode: 404, code: 'CATEGORY_NOT_FOUND' });
  });

  test('400 for an invalid order', async () => {
    await expect(categories.updateCategory('c1', { order: 'first' })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('deleteCategory', () => {
  test('deletes when no post references the category', async () => {
    model.findById.mockResolvedValue({ _id: 'c1', slug: 'money' });
    (isCategoryInUse as jest.Mock).mockResolvedValue(false);

    await expect(categories.deleteCategory('c1')).resolves.toBeUndefined();

    expect(isCategoryInUse).toHaveBeenCalledWith('money');
    expect(model.delete).toHaveBeenCalledWith('c1');
  });

  test('409 CATEGORY_IN_USE when a post still references it — and does not delete', async () => {
    model.findById.mockResolvedValue({ _id: 'c1', slug: 'money' });
    (isCategoryInUse as jest.Mock).mockResolvedValue(true);

    await expect(categories.deleteCategory('c1')).rejects.toMatchObject({ statusCode: 409, code: 'CATEGORY_IN_USE' });
    expect(model.delete).not.toHaveBeenCalled();
  });

  test('404 when the category does not exist (guard not even consulted)', async () => {
    model.findById.mockResolvedValue(null);
    await expect(categories.deleteCategory('ghost')).rejects.toMatchObject({ statusCode: 404 });
    expect(isCategoryInUse).not.toHaveBeenCalled();
  });
});

describe('reorder', () => {
  test('updates the order of each item', async () => {
    model.updateById.mockResolvedValue({});
    await categories.reorder([{ id: 'a', order: 0 }, { id: 'b', order: 1 }]);
    expect(model.updateById).toHaveBeenCalledWith('a', { order: 0 });
    expect(model.updateById).toHaveBeenCalledWith('b', { order: 1 });
  });

  test('400 when items is not a valid array', async () => {
    await expect(categories.reorder([{ id: 'a' }])).rejects.toMatchObject({ statusCode: 400 });
    await expect(categories.reorder('nope')).rejects.toMatchObject({ statusCode: 400 });
  });
});
