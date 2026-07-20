// Pin these before importing dynamo.ts (which calls dotenv.config() at load). dotenv won't
// override already-set vars, so this keeps the module in DynamoDB mode regardless of what the
// local .env holds (it may set AUTH_STORE=memory for dev). The memory-mode block below opts in
// explicitly via resetModules.
process.env.AWS_REGION = 'us-east-1';
process.env.DYNAMO_DEDUP_TABLE = 'test_view_dedup';
process.env.DYNAMO_RATELIMIT_TABLE = 'test_ratelimit';
process.env.DYNAMO_REFRESH_TABLE = 'test_refresh';
process.env.AUTH_STORE = 'dynamo';

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  checkAndSetViewDedup,
  checkRateLimit,
  consumeRefreshToken,
  revokeRefreshToken,
  storeRefreshToken,
} from '../../lib/dynamo';

// Only `.send()` performs real I/O — spying on it (rather than automocking the whole
// module) leaves PutItemCommand/UpdateItemCommand real, so `command.input` reflects
// exactly what dynamo.ts constructed, with zero real network calls.
//
// `send` is heavily overloaded (one signature per command + callback variants), which
// makes `jest.spyOn(...).mockResolvedValue(...)` infer a `never` parameter type directly
// — cast through `unknown` once here instead of at every call site.
function spyOnSend(): jest.Mock {
  return jest.spyOn(DynamoDBClient.prototype, 'send') as unknown as jest.Mock;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('checkAndSetViewDedup', () => {
  test('sends a conditional PutItem and returns true on first view', async () => {
    const send = spyOnSend().mockResolvedValue({});

    await expect(checkAndSetViewDedup('1.2.3.4', 'post1')).resolves.toBe(true);

    const command = send.mock.calls[0][0] as any;
    expect(command.input.TableName).toBe('test_view_dedup');
    expect(command.input.Item.pk.S).toBe('view:1.2.3.4:post1');
    expect(command.input.ConditionExpression).toBe('attribute_not_exists(pk)');
    expect(Number(command.input.Item.ttl.N)).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  test('returns false on a duplicate (ConditionalCheckFailedException)', async () => {
    const err = Object.assign(new Error('conditional check failed'), {
      name: 'ConditionalCheckFailedException',
    });
    spyOnSend().mockRejectedValue(err);

    await expect(checkAndSetViewDedup('1.2.3.4', 'post1')).resolves.toBe(false);
  });

  test('re-throws any other error', async () => {
    spyOnSend().mockRejectedValue(new Error('network blip'));

    await expect(checkAndSetViewDedup('1.2.3.4', 'post1')).rejects.toThrow('network blip');
  });
});

describe('checkRateLimit', () => {
  test('sends an atomic UpdateItem (ADD + if_not_exists ttl) and allows when count <= 3', async () => {
    const send = spyOnSend().mockResolvedValue({ Attributes: { count: { N: '1' } } });

    await expect(checkRateLimit('1.2.3.4')).resolves.toBe(true);

    const command = send.mock.calls[0][0] as any;
    expect(command.input.TableName).toBe('test_ratelimit');
    expect(command.input.Key.pk.S).toBe('ratelimit:1.2.3.4');
    expect(command.input.UpdateExpression).toContain('ADD #count :one');
    expect(command.input.UpdateExpression).toContain('if_not_exists(#ttl, :ttl)');
  });

  test('allows exactly at the limit (count === 3)', async () => {
    spyOnSend().mockResolvedValue({ Attributes: { count: { N: '3' } } });

    await expect(checkRateLimit('1.2.3.4')).resolves.toBe(true);
  });

  test('denies once the count exceeds the limit', async () => {
    spyOnSend().mockResolvedValue({ Attributes: { count: { N: '4' } } });

    await expect(checkRateLimit('1.2.3.4')).resolves.toBe(false);
  });
});

describe('refresh-token store', () => {
  const future = () => Math.floor(Date.now() / 1000) + 3600;
  const past = () => Math.floor(Date.now() / 1000) - 10;

  test('storeRefreshToken writes pk/userId/ttl to the refresh table', async () => {
    const send = spyOnSend().mockResolvedValue({});

    await storeRefreshToken('tok', 'user1', 3600);

    const command = send.mock.calls[0][0] as any;
    expect(command.input.TableName).toBe('test_refresh');
    expect(command.input.Item.pk.S).toBe('refresh:tok');
    expect(command.input.Item.userId.S).toBe('user1');
    expect(Number(command.input.Item.ttl.N)).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  test('consumeRefreshToken deletes with ReturnValues ALL_OLD and returns the userId', async () => {
    const send = spyOnSend().mockResolvedValue({
      Attributes: { userId: { S: 'user1' }, ttl: { N: String(future()) } },
    });

    await expect(consumeRefreshToken('tok')).resolves.toBe('user1');

    const command = send.mock.calls[0][0] as any;
    expect(command.input.TableName).toBe('test_refresh');
    expect(command.input.Key.pk.S).toBe('refresh:tok');
    expect(command.input.ReturnValues).toBe('ALL_OLD');
  });

  test('consumeRefreshToken returns null when the token was absent', async () => {
    spyOnSend().mockResolvedValue({}); // no Attributes = nothing deleted
    await expect(consumeRefreshToken('missing')).resolves.toBeNull();
  });

  test('consumeRefreshToken returns null for an expired-but-not-yet-purged token', async () => {
    spyOnSend().mockResolvedValue({
      Attributes: { userId: { S: 'user1' }, ttl: { N: String(past()) } },
    });
    await expect(consumeRefreshToken('stale')).resolves.toBeNull();
  });

  test('revokeRefreshToken issues an unconditional delete', async () => {
    const send = spyOnSend().mockResolvedValue({});

    await revokeRefreshToken('tok');

    const command = send.mock.calls[0][0] as any;
    expect(command.input.TableName).toBe('test_refresh');
    expect(command.input.Key.pk.S).toBe('refresh:tok');
    expect(command.input.ReturnValues).toBeUndefined();
  });
});

describe('refresh-token store — in-memory fallback (AUTH_STORE=memory)', () => {
  // Re-import the module with AUTH_STORE=memory so it selects the in-process Map path. If the
  // fallback were NOT taken, these calls would hit a real DynamoDBClient (no creds) and reject —
  // so the fact they resolve is itself proof the memory branch is used, with zero AWS I/O.
  function loadMemoryStore(): typeof import('../../lib/dynamo') {
    jest.resetModules();
    const prev = process.env.AUTH_STORE;
    process.env.AUTH_STORE = 'memory';
    jest.spyOn(console, 'warn').mockImplementation(() => {}); // silence the load-time notice
    const mod = require('../../lib/dynamo') as typeof import('../../lib/dynamo');
    process.env.AUTH_STORE = prev;
    return mod;
  }

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  test('store → consume returns the userId, and a second consume is null (rotation)', async () => {
    const store = loadMemoryStore();
    await store.storeRefreshToken('tok', 'user1', 3600);
    await expect(store.consumeRefreshToken('tok')).resolves.toBe('user1');
    await expect(store.consumeRefreshToken('tok')).resolves.toBeNull();
  });

  test('consume returns null for an unknown token', async () => {
    const store = loadMemoryStore();
    await expect(store.consumeRefreshToken('nope')).resolves.toBeNull();
  });

  test('consume returns null for an expired token', async () => {
    const store = loadMemoryStore();
    await store.storeRefreshToken('old', 'user1', -1); // already expired
    await expect(store.consumeRefreshToken('old')).resolves.toBeNull();
  });

  test('revoke removes the token (subsequent consume is null)', async () => {
    const store = loadMemoryStore();
    await store.storeRefreshToken('tok2', 'user2', 3600);
    await store.revokeRefreshToken('tok2');
    await expect(store.consumeRefreshToken('tok2')).resolves.toBeNull();
  });
});
