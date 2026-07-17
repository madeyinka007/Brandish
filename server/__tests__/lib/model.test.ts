// mongo.ts imports lib/mongoose.ts, which connects to Mongo as a top-level side effect —
// mock it before jest.mock('../../lib/mongo') needs to load the real module to automock it.
jest.mock('../../lib/mongoose', () => ({
  dbConnect: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../lib/mongo');

import { BaseModel } from '../../lib/model';
import { MongoLibrary } from '../../lib/mongo';

interface TestDoc {
  name: string;
}

// Concrete domain model, exactly the shape real ones (Post, User, ...) will take.
class TestModel extends BaseModel<TestDoc> {
  constructor() {
    super({} as any); // the Mongoose Model itself is irrelevant here — MongoLibrary is mocked
  }
}

describe('BaseModel', () => {
  let instance: TestModel;
  let lib: jest.Mocked<MongoLibrary<TestDoc>>;

  beforeEach(() => {
    (MongoLibrary as unknown as jest.Mock).mockClear();
    instance = new TestModel();
    lib = (MongoLibrary as unknown as jest.Mock).mock.instances[0];
  });

  test('constructor instantiates exactly one MongoLibrary bound to the given model', () => {
    expect(MongoLibrary).toHaveBeenCalledTimes(1);
  });

  test('.create() delegates to MongoLibrary#create', async () => {
    (lib.create as jest.Mock).mockResolvedValue({ name: 'x' });

    await expect(instance.create({ name: 'x' })).resolves.toEqual({ name: 'x' });
    expect(lib.create).toHaveBeenCalledWith({ name: 'x' });
  });

  test('.find() delegates to MongoLibrary#find', async () => {
    (lib.find as jest.Mock).mockResolvedValue([{ name: 'x' }]);

    await expect(instance.find({ name: 'x' }, { limit: 10 })).resolves.toEqual([{ name: 'x' }]);
    expect(lib.find).toHaveBeenCalledWith({ name: 'x' }, { limit: 10 });
  });

  test('.findOne() delegates to MongoLibrary#findOne', async () => {
    (lib.findOne as jest.Mock).mockResolvedValue({ name: 'x' });

    await expect(instance.findOne({ name: 'x' }, 'author')).resolves.toEqual({ name: 'x' });
    expect(lib.findOne).toHaveBeenCalledWith({ name: 'x' }, 'author');
  });

  test('.findById() delegates to MongoLibrary#findById', async () => {
    (lib.findById as jest.Mock).mockResolvedValue({ name: 'x' });

    await expect(instance.findById('1', 'author')).resolves.toEqual({ name: 'x' });
    expect(lib.findById).toHaveBeenCalledWith('1', 'author');
  });

  test('.update() delegates to MongoLibrary#updateOne', async () => {
    (lib.updateOne as jest.Mock).mockResolvedValue({ name: 'updated' });

    await expect(instance.update({ name: 'x' }, { name: 'updated' })).resolves.toEqual({ name: 'updated' });
    expect(lib.updateOne).toHaveBeenCalledWith({ name: 'x' }, { name: 'updated' });
  });

  test('.updateById() delegates to MongoLibrary#updateById', async () => {
    (lib.updateById as jest.Mock).mockResolvedValue({ name: 'updated' });

    await expect(instance.updateById('1', { name: 'updated' })).resolves.toEqual({ name: 'updated' });
    expect(lib.updateById).toHaveBeenCalledWith('1', { name: 'updated' });
  });

  test('.delete() delegates to MongoLibrary#deleteById', async () => {
    (lib.deleteById as jest.Mock).mockResolvedValue({ name: 'x' });

    await expect(instance.delete('1')).resolves.toEqual({ name: 'x' });
    expect(lib.deleteById).toHaveBeenCalledWith('1');
  });

  test('.aggregate() delegates to MongoLibrary#aggregate', async () => {
    const pipeline = [{ $match: { name: 'x' } }];
    (lib.aggregate as jest.Mock).mockResolvedValue([{ count: 1 }]);

    await expect(instance.aggregate(pipeline as any)).resolves.toEqual([{ count: 1 }]);
    expect(lib.aggregate).toHaveBeenCalledWith(pipeline);
  });

  test('.populate() delegates to MongoLibrary#populate', async () => {
    (lib.populate as jest.Mock).mockResolvedValue({ name: 'x', author: { name: 'Ada' } });

    await expect(instance.populate({ name: 'x' } as any, 'author')).resolves.toEqual({ name: 'x', author: { name: 'Ada' } });
    expect(lib.populate).toHaveBeenCalledWith({ name: 'x' }, 'author');
  });

  test('.paginate() delegates to MongoLibrary#paginate', async () => {
    const page = { data: [{ name: 'x' }], total: 1, page: 1, limit: 20, totalPages: 1 };
    (lib.paginate as jest.Mock).mockResolvedValue(page);

    await expect(instance.paginate({ name: 'x' }, { page: 1 })).resolves.toEqual(page);
    expect(lib.paginate).toHaveBeenCalledWith({ name: 'x' }, { page: 1 });
  });

  test('.exists() delegates to MongoLibrary#exists', async () => {
    (lib.exists as jest.Mock).mockResolvedValue(true);

    await expect(instance.exists({ name: 'x' })).resolves.toBe(true);
    expect(lib.exists).toHaveBeenCalledWith({ name: 'x' });
  });

  test('.count() delegates to MongoLibrary#count', async () => {
    (lib.count as jest.Mock).mockResolvedValue(3);

    await expect(instance.count({ name: 'x' })).resolves.toBe(3);
    expect(lib.count).toHaveBeenCalledWith({ name: 'x' });
  });
});
