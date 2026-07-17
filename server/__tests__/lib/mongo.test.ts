jest.mock('../../lib/mongoose', () => ({
  dbConnect: jest.fn().mockResolvedValue(undefined),
}));

import { MongoLibrary } from '../../lib/mongo';
import { dbConnect } from '../../lib/mongoose';

/** Chainable single-document query mock — `.populate()` returns itself, `.exec()` resolves. */
function createMockSingleQuery<R>(resolvedValue: R) {
  const query: Record<string, jest.Mock> = {};
  query.populate = jest.fn(() => query);
  query.exec = jest.fn().mockResolvedValue(resolvedValue);
  return query;
}

/** Chainable list-query mock — sort/select/populate/skip/limit all return itself, `.exec()` resolves. */
function createMockListQuery<R>(resolvedValue: R[]) {
  const query: Record<string, jest.Mock> = {};
  for (const method of ['sort', 'select', 'populate', 'skip', 'limit']) {
    query[method] = jest.fn(() => query);
  }
  query.exec = jest.fn().mockResolvedValue(resolvedValue);
  return query;
}

beforeEach(() => {
  (dbConnect as jest.Mock).mockClear();
});

describe('MongoLibrary.createModel (static)', () => {
  test('connects first, then defines a real schema/model with the given indexes', async () => {
    interface Doc { name: string }

    const Model = await MongoLibrary.createModel<Doc>(
      `MongoLibrarySpec_${Date.now()}`,
      { name: String },
      { timestamps: true },
      [[{ name: 1 }, { unique: true }]],
    );

    expect(dbConnect).toHaveBeenCalledTimes(1);
    expect(Model.modelName).toContain('MongoLibrarySpec_');
    expect(Model.schema.indexes()).toContainEqual([{ name: 1 }, expect.objectContaining({ unique: true })]);
  });
});

describe('MongoLibrary instance CRUD', () => {
  test('.create() connects then delegates to model.create', async () => {
    const create = jest.fn().mockResolvedValue({ _id: '1', title: 'New Post' });
    const lib = new MongoLibrary({ create } as any);

    await expect(lib.create({ title: 'New Post' })).resolves.toEqual({ _id: '1', title: 'New Post' });
    expect(dbConnect).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({ title: 'New Post' });
  });

  test('.findById() execs without populate by default', async () => {
    const single = createMockSingleQuery({ _id: '1' });
    const findById = jest.fn(() => single);
    const lib = new MongoLibrary({ findById } as any);

    await expect(lib.findById('1')).resolves.toEqual({ _id: '1' });
    expect(findById).toHaveBeenCalledWith('1');
    expect(single.populate).not.toHaveBeenCalled();
  });

  test('.findById() populates when a path is given', async () => {
    const single = createMockSingleQuery({ _id: '1' });
    const findById = jest.fn(() => single);
    const lib = new MongoLibrary({ findById } as any);

    await lib.findById('1', 'author');

    expect(single.populate).toHaveBeenCalledWith('author');
  });

  test('.find() applies filter, sort, select, populate, and default pagination', async () => {
    const listQuery = createMockListQuery([{ _id: '1' }]);
    const find = jest.fn(() => listQuery);
    const lib = new MongoLibrary({ find } as any);

    const result = await lib.find({ status: 'published' }, {
      sort: '-createdAt',
      select: 'title slug',
      populate: 'author',
    });

    expect(result).toEqual([{ _id: '1' }]);
    expect(find).toHaveBeenCalledWith({ status: 'published' });
    expect(listQuery.sort).toHaveBeenCalledWith('-createdAt');
    expect(listQuery.select).toHaveBeenCalledWith('title slug');
    expect(listQuery.populate).toHaveBeenCalledWith('author');
    expect(listQuery.skip).toHaveBeenCalledWith(0);
    expect(listQuery.limit).toHaveBeenCalledWith(20);
  });

  test('.find() caps limit at 100', async () => {
    const listQuery = createMockListQuery([]);
    const find = jest.fn(() => listQuery);
    const lib = new MongoLibrary({ find } as any);

    await lib.find({}, { page: 2, limit: 999 });

    expect(listQuery.skip).toHaveBeenCalledWith(100); // (page 2 - 1) * limit 100
    expect(listQuery.limit).toHaveBeenCalledWith(100);
  });

  test('.paginate() returns data + total/page/limit/totalPages', async () => {
    const listQuery = createMockListQuery([{ _id: '1' }, { _id: '2' }]);
    const find = jest.fn(() => listQuery);
    const countDocuments = jest.fn(() => ({ exec: jest.fn().mockResolvedValue(45) }));
    const lib = new MongoLibrary({ find, countDocuments } as any);

    const result = await lib.paginate({ status: 'published' }, { limit: 20 });

    expect(result).toEqual({
      data: [{ _id: '1' }, { _id: '2' }],
      total: 45,
      page: 1,
      limit: 20,
      totalPages: 3,
    });
    expect(countDocuments).toHaveBeenCalledWith({ status: 'published' });
  });

  test('.updateById() calls findByIdAndUpdate with { new: true, runValidators: true }', async () => {
    const single = createMockSingleQuery({ _id: '1', title: 'Updated' });
    const findByIdAndUpdate = jest.fn(() => single);
    const lib = new MongoLibrary({ findByIdAndUpdate } as any);

    await expect(lib.updateById('1', { title: 'Updated' })).resolves.toEqual({ _id: '1', title: 'Updated' });
    expect(findByIdAndUpdate).toHaveBeenCalledWith('1', { title: 'Updated' }, { new: true, runValidators: true });
  });

  test('.deleteById() calls findByIdAndDelete', async () => {
    const single = createMockSingleQuery({ _id: '1' });
    const findByIdAndDelete = jest.fn(() => single);
    const lib = new MongoLibrary({ findByIdAndDelete } as any);

    await expect(lib.deleteById('1')).resolves.toEqual({ _id: '1' });
    expect(findByIdAndDelete).toHaveBeenCalledWith('1');
  });

  test('.count() defaults to an empty filter', async () => {
    const countDocuments = jest.fn(() => ({ exec: jest.fn().mockResolvedValue(5) }));
    const lib = new MongoLibrary({ countDocuments } as any);

    await expect(lib.count()).resolves.toBe(5);
    expect(countDocuments).toHaveBeenCalledWith({});
  });

  test('.exists() returns true when Mongoose finds a match, false otherwise', async () => {
    const exists = jest.fn().mockResolvedValueOnce({ _id: '1' }).mockResolvedValueOnce(null);
    const lib = new MongoLibrary({ exists } as any);

    await expect(lib.exists({ slug: 'exists' })).resolves.toBe(true);
    await expect(lib.exists({ slug: 'missing' })).resolves.toBe(false);
  });

  test('.populate() re-populates already-fetched document(s)', async () => {
    const populate = jest.fn().mockResolvedValue({ _id: '1', author: { name: 'Ada' } });
    const lib = new MongoLibrary({ populate } as any);

    await expect(lib.populate({ _id: '1', author: 'u1' } as any, 'author')).resolves.toEqual({
      _id: '1',
      author: { name: 'Ada' },
    });
    expect(populate).toHaveBeenCalledWith({ _id: '1', author: 'u1' }, 'author');
  });
});

describe('MongoLibrary instance aggregate', () => {
  test('runs the given pipeline and returns the result array', async () => {
    const aggregateResult = [{ _id: 'technology', count: 3 }];
    const aggregate = jest.fn(() => ({ exec: jest.fn().mockResolvedValue(aggregateResult) }));
    const lib = new MongoLibrary({ aggregate } as any);
    const pipeline = [{ $group: { _id: '$category', count: { $sum: 1 } } }];

    await expect(lib.aggregate(pipeline as any)).resolves.toEqual(aggregateResult);
    expect(aggregate).toHaveBeenCalledWith(pipeline);
  });
});
