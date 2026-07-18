// bootstrap defers importing the real app — mock both sides so this is a pure unit test
// (no secret fetch, no Express/Mongo import chain). resetModules per test gives each a fresh
// module-scoped handler cache and fresh mock fns.
jest.mock('../lib/loadSecrets', () => ({ loadSecrets: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../index', () => ({ handler: jest.fn().mockResolvedValue({ statusCode: 200 }) }));

beforeEach(() => jest.resetModules());

function load() {
  const { loadSecrets } = require('../lib/loadSecrets');
  const index = require('../index');
  const { handler } = require('../bootstrap');
  return { loadSecrets, index, handler };
}

test('loads secrets before importing the app, then delegates to its handler', async () => {
  const { loadSecrets, index, handler } = load();
  const res = await handler({ e: 1 }, { c: 2 });

  expect(loadSecrets).toHaveBeenCalledTimes(1);
  expect(index.handler).toHaveBeenCalledWith({ e: 1 }, { c: 2 });
  expect(res).toEqual({ statusCode: 200 });
});

test('reuses the cached app handler on a warm invocation (loads once, delegates each call)', async () => {
  const { loadSecrets, index, handler } = load();
  await handler({}, {});
  await handler({}, {});

  expect(loadSecrets).toHaveBeenCalledTimes(1);
  expect(index.handler).toHaveBeenCalledTimes(2);
});
