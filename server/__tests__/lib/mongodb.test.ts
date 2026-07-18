// MongoClient.connect() runs as a top-level side effect in lib/mongodb.ts, so the mock
// must be in place before the module is required. resetModules + fresh require re-runs it.
jest.mock('mongodb', () => {
  const db = jest.fn((name: string) => ({ __db: name }));
  const connect = jest.fn().mockResolvedValue({ db });
  const MongoClient = jest.fn().mockImplementation(() => ({ connect }));
  return { MongoClient, ObjectId: jest.fn() };
});

const ORIGINAL_ENV_MONGODB = process.env;

function loadMongodbLib() {
  jest.resetModules();
  return require('../../lib/mongodb');
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV_MONGODB, MONGODB_URI: 'mongodb://test/db', NODE_ENV: 'test' };
  delete (global as any)._mongoClientPromise;
});

afterAll(() => {
  process.env = ORIGINAL_ENV_MONGODB;
});

describe('getDb', () => {
  test("defaults to the 'wt-brandish' database (same as the Mongoose connection)", async () => {
    const { getDb } = loadMongodbLib();
    const db = await getDb();
    expect(db).toEqual({ __db: 'wt-brandish' });
  });

  test('honors an explicit db name', async () => {
    const { getDb } = loadMongodbLib();
    const db = await getDb('other');
    expect(db).toEqual({ __db: 'other' });
  });

  test('connects once and reuses the client across getDb calls', async () => {
    const { MongoClient } = require('mongodb');
    const { getDb } = loadMongodbLib();
    await getDb();
    await getDb();
    // One client constructed, connected once — subsequent getDb reuses the cached promise.
    expect((MongoClient as jest.Mock).mock.instances.length).toBe(1);
  });
});
