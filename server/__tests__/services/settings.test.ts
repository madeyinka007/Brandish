jest.mock('../../lib/mongodb', () => ({ getDb: jest.fn() }));

import { getDb } from '../../lib/mongodb';
import * as settings from '../../services/settings';

let col: { findOne: jest.Mock; updateOne: jest.Mock };

function mockDb(stored: any) {
  col = {
    findOne: jest.fn().mockResolvedValue(stored),
    updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
  };
  (getDb as jest.Mock).mockResolvedValue({ collection: jest.fn(() => col) });
}

beforeEach(() => {
  jest.clearAllMocks();
  settings._clearCache();
});

describe('getSettings', () => {
  test('returns full defaults when no document exists', async () => {
    mockDb(null);
    const s = await settings.getSettings();
    expect(s).toMatchObject(settings.DEFAULT_SETTINGS);
    expect(col.findOne).toHaveBeenCalledWith({ _id: 'site' });
  });

  test('merges a partial stored doc over defaults (additive-safe)', async () => {
    mockDb({ site: { title: 'My Blog', postsPerPage: 24 }, appearance: { theme: 'dark' } });
    const s = await settings.getSettings();
    expect(s.site.title).toBe('My Blog');
    expect(s.site.postsPerPage).toBe(24);
    expect(s.site.timezone).toBe('Africa/Lagos'); // untouched default
    expect(s.appearance.theme).toBe('dark');
    expect(s.reading.excerptWords).toBe(55); // whole section defaulted
  });

  test('caches — a second call within TTL does not re-query', async () => {
    mockDb({ site: { title: 'Cached' } });
    await settings.getSettings();
    await settings.getSettings();
    expect(col.findOne).toHaveBeenCalledTimes(1);
  });
});

describe('toPublic', () => {
  test('exposes site/appearance/reading + limited comments, and drops moderation flags', async () => {
    mockDb(null);
    const pub = await settings.getPublicSettings();
    expect(pub.site.title).toBe('Brandish');
    expect(pub.appearance.theme).toBe('light');
    expect(pub.comments).toEqual({ whoCanComment: 'anyone', nestingDepth: 3 });
    expect((pub.comments as any).holdForModeration).toBeUndefined();
    expect((pub as any).updatedBy).toBeUndefined();
  });
});

describe('updateSettings', () => {
  test('coerces + clamps a patch, stamps updatedBy, upserts and busts cache', async () => {
    mockDb({});
    const next = await settings.updateSettings(
      { site: { title: 'Renamed', postsPerPage: 999 }, appearance: { theme: 'dark', accentColor: 'nope' } },
      'user-1',
    );
    expect(next.site.title).toBe('Renamed');
    expect(next.site.postsPerPage).toBe(100); // clamped to max
    expect(next.appearance.theme).toBe('dark');
    expect(next.appearance.accentColor).toBe('#4F46E5'); // invalid hex → kept default
    expect(next.updatedBy).toBe('user-1');
    expect(next.updatedAt).toBeInstanceOf(Date);

    const [filter, update, options] = col.updateOne.mock.calls[0];
    expect(filter).toEqual({ _id: 'site' });
    expect(options).toEqual({ upsert: true });
    expect(update.$set._id).toBeUndefined(); // _id comes from the filter on insert, never $set
    expect(update.$set.site.title).toBe('Renamed');
  });

  test('unknown top-level keys are ignored (only known sections merged)', async () => {
    mockDb({});
    const next = await settings.updateSettings({ hacker: { x: 1 }, comments: { nestingDepth: 5 } } as any, 'u');
    expect((next as any).hacker).toBeUndefined();
    expect(next.comments.nestingDepth).toBe(5);
  });

  test('rejects a non-object patch', async () => {
    mockDb({});
    await expect(settings.updateSettings(null as any, 'u')).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_SETTINGS' });
  });

  test('enum guard: an invalid theme falls back to the current value', async () => {
    mockDb({ appearance: { theme: 'dark' } });
    const next = await settings.updateSettings({ appearance: { theme: 'rainbow' } } as any, 'u');
    expect(next.appearance.theme).toBe('dark');
  });
});
