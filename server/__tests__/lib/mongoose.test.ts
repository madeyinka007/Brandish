jest.mock('mongoose');

const ORIGINAL_ENV = process.env;

/** `mongoose.connect(uri, options)` runs as a *top-level* side effect in lib/mongoose.ts,
 *  so the mock must be configured and process.env set BEFORE the module is required —
 *  jest.resetModules() + a fresh require() is what forces that top-level code to re-run. */
function loadMongooseLib() {
  jest.resetModules();
  const mongoose = require('mongoose');
  (mongoose.connect as jest.Mock).mockResolvedValue(mongoose);
  return { mongoose, ...require('../../lib/mongoose') };
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, MONGODB_URI: 'mongodb://test-uri/wt-brandish', NODE_ENV: 'test' };
  delete (global as any)._mongooseConnPromise;
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('dbConnect (non-development — module-scope caching)', () => {
  test('calls mongoose.connect with MONGODB_URI and the documented options', async () => {
    const { mongoose, dbConnect } = loadMongooseLib();

    await dbConnect();

    expect(mongoose.connect).toHaveBeenCalledWith('mongodb://test-uri/wt-brandish', {
      maxPoolSize: 10,
      dbName: 'wt-brandish',
    });
  });

  test('calling dbConnect() twice only calls mongoose.connect once', async () => {
    const { mongoose, dbConnect } = loadMongooseLib();

    await dbConnect();
    await dbConnect();

    expect(mongoose.connect).toHaveBeenCalledTimes(1);
  });
});

describe('dbConnect (development — global-cached across hot-reloads)', () => {
  test('reuses global._mongooseConnPromise instead of calling mongoose.connect again on a simulated hot-reload', async () => {
    (process.env as any).NODE_ENV = 'development';

    const first = loadMongooseLib();
    await first.dbConnect();
    expect(first.mongoose.connect).toHaveBeenCalledTimes(1);

    // Simulate a dev hot-reload: the module is re-required (jest.resetModules() inside
    // loadMongooseLib), but `global` — where the cached promise lives — persists, same
    // as it would across a real hot-reload in a running dev server.
    const second = loadMongooseLib();
    await second.dbConnect();

    expect(second.mongoose.connect).not.toHaveBeenCalled();
  });
});
