jest.mock('../../lib/mongodb', () => ({ getDb: jest.fn() }));
jest.mock('../../lib/dynamo', () => ({ checkAndSetViewDedup: jest.fn() }));

import { ObjectId } from 'mongodb';
import { getDb } from '../../lib/mongodb';
import { checkAndSetViewDedup } from '../../lib/dynamo';
import * as views from '../../services/views';

const VALID_ID = '507f1f77bcf86cd799439011';

let pageViews: { insertOne: jest.Mock };
let posts: { updateOne: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  pageViews = { insertOne: jest.fn().mockResolvedValue({}) };
  posts = { updateOne: jest.fn().mockResolvedValue({}) };
  const db = { collection: jest.fn((name: string) => (name === 'page_views' ? pageViews : posts)) };
  (getDb as jest.Mock).mockResolvedValue(db);
});

describe('recordView', () => {
  test('invalid postId is ignored — no event, no dedup, returns false', async () => {
    await expect(views.recordView('not-an-id', { ip: '1.2.3.4' })).resolves.toBe(false);
    await expect(views.recordView(undefined, { ip: '1.2.3.4' })).resolves.toBe(false);
    expect(pageViews.insertOne).not.toHaveBeenCalled();
    expect(checkAndSetViewDedup).not.toHaveBeenCalled();
    expect(posts.updateOne).not.toHaveBeenCalled();
  });

  test('first view (dedup true): logs the event AND increments viewCount, returns true', async () => {
    (checkAndSetViewDedup as jest.Mock).mockResolvedValue(true);
    const result = await views.recordView(VALID_ID, {
      ip: '9.9.9.9',
      userAgent: 'Mozilla/5.0',
      referrer: 'https://google.com/',
    });

    expect(result).toBe(true);
    const doc = pageViews.insertOne.mock.calls[0][0];
    expect(doc.postId).toBeInstanceOf(ObjectId);
    expect(String(doc.postId)).toBe(VALID_ID);
    expect(doc.ip).toBe('9.9.9.9');
    expect(doc.userAgent).toBe('Mozilla/5.0');
    expect(doc.referrer).toBe('https://google.com/');
    expect(doc.dwellSec).toBe(0);
    expect(doc.viewedAt).toBeInstanceOf(Date);
    expect(doc).not.toHaveProperty('_demo');

    expect(checkAndSetViewDedup).toHaveBeenCalledWith('9.9.9.9', VALID_ID);
    expect(posts.updateOne).toHaveBeenCalledTimes(1);
    const [filter, update] = posts.updateOne.mock.calls[0];
    expect(String(filter._id)).toBe(VALID_ID);
    expect(update).toEqual({ $inc: { viewCount: 1 } });
  });

  test('duplicate view (dedup false): logs the event but does NOT increment viewCount, returns false', async () => {
    (checkAndSetViewDedup as jest.Mock).mockResolvedValue(false);
    const result = await views.recordView(VALID_ID, { ip: '9.9.9.9' });

    expect(result).toBe(false);
    expect(pageViews.insertOne).toHaveBeenCalledTimes(1); // every hit is still logged
    expect(posts.updateOne).not.toHaveBeenCalled();
  });

  test('missing ip falls back to "unknown" and defaults referrer/userAgent', async () => {
    (checkAndSetViewDedup as jest.Mock).mockResolvedValue(true);
    await views.recordView(VALID_ID, { ip: '' });
    const doc = pageViews.insertOne.mock.calls[0][0];
    expect(doc.ip).toBe('unknown');
    expect(doc.userAgent).toBe('');
    expect(doc.referrer).toBeNull();
    expect(checkAndSetViewDedup).toHaveBeenCalledWith('unknown', VALID_ID);
  });

  test('dwellSec is clamped to 0..3600 and floored', async () => {
    (checkAndSetViewDedup as jest.Mock).mockResolvedValue(false);
    await views.recordView(VALID_ID, { ip: 'x', dwellSec: 99999.7 });
    expect(pageViews.insertOne.mock.calls[0][0].dwellSec).toBe(3600);
    await views.recordView(VALID_ID, { ip: 'x', dwellSec: -5 });
    expect(pageViews.insertOne.mock.calls[1][0].dwellSec).toBe(0);
    await views.recordView(VALID_ID, { ip: 'x', dwellSec: 42.9 });
    expect(pageViews.insertOne.mock.calls[2][0].dwellSec).toBe(42);
  });
});
