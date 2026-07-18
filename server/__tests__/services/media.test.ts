// Factory mock (not automock) so the real lib/mongodb.ts — which opens a Mongo connection
// at import time — never loads.
jest.mock('../../lib/mongodb', () => ({ getDb: jest.fn() }));
jest.mock('../../lib/imageUrl');
jest.mock('../../lib/s3');
jest.mock('mongodb', () => ({
  // A tiny ObjectId stub — records the input so assertions can read it back.
  ObjectId: jest.fn().mockImplementation((id?: string) => ({ __oid: id ?? 'generated', toString: () => id ?? 'generated' })),
}));

import { getDb } from '../../lib/mongodb';
import { validateImageUrl } from '../../lib/imageUrl';
import { deleteObject, keyFromCdnUrl } from '../../lib/s3';
import * as media from '../../services/media';

process.env.CF_DOMAIN = 'd1abc.cloudfront.net';

let col: {
  find: jest.Mock;
  insertOne: jest.Mock;
  findOne: jest.Mock;
  deleteOne: jest.Mock;
};

function chainableFind(result: any[]) {
  const chain: any = {};
  chain.sort = jest.fn(() => chain);
  chain.skip = jest.fn(() => chain);
  chain.limit = jest.fn(() => chain);
  chain.toArray = jest.fn().mockResolvedValue(result);
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
  col = {
    find: jest.fn(() => chainableFind([])),
    insertOne: jest.fn().mockResolvedValue({ insertedId: 'new-id' }),
    findOne: jest.fn(),
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  };
  (getDb as jest.Mock).mockResolvedValue({ collection: jest.fn(() => col) });
  (keyFromCdnUrl as jest.Mock).mockImplementation((url: string) => `key-of-${url}`);
});

describe('listMedia', () => {
  test('queries with newest-first sort and pagination', async () => {
    const chain = chainableFind([{ _id: '1' }]);
    col.find.mockReturnValue(chain);

    const result = await media.listMedia(2, 10);

    expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(chain.skip).toHaveBeenCalledWith(10); // (page 2 - 1) * 10
    expect(chain.limit).toHaveBeenCalledWith(10);
    expect(result).toEqual([{ _id: '1' }]);
  });
});

describe('createFromUpload', () => {
  test('inserts a source:upload record for a valid CloudFront url', async () => {
    const doc = await media.createFromUpload(
      { filename: 'cover.jpg', url: 'https://d1abc.cloudfront.net/media/x.jpg', size: 2048, mimeType: 'image/jpeg' },
      'user1',
    );

    const inserted = col.insertOne.mock.calls[0][0];
    expect(inserted).toMatchObject({ source: 'upload', filename: 'cover.jpg', size: 2048, mimeType: 'image/jpeg' });
    expect(doc._id).toBe('new-id');
  });

  test('400 when url is not under the CloudFront domain (mislabeled as upload)', async () => {
    await expect(
      media.createFromUpload({ filename: 'x.jpg', url: 'https://evil.example/x.jpg' }, 'user1'),
    ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_MEDIA_INPUT' });
    expect(col.insertOne).not.toHaveBeenCalled();
  });

  test('400 when filename or url is missing', async () => {
    await expect(media.createFromUpload({ url: 'https://d1abc.cloudfront.net/x.jpg' }, 'user1')).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('createFromUrl', () => {
  test('validates via the SSRF guard, then inserts a source:url record', async () => {
    (validateImageUrl as jest.Mock).mockResolvedValue({ ok: true, mimeType: 'image/png' });

    const doc = await media.createFromUrl('https://cdn.example/p.png', 'user1');

    expect(validateImageUrl).toHaveBeenCalledWith('https://cdn.example/p.png');
    const inserted = col.insertOne.mock.calls[0][0];
    expect(inserted).toMatchObject({ source: 'url', filename: null, size: null, mimeType: 'image/png', url: 'https://cdn.example/p.png' });
    expect(doc._id).toBe('new-id');
  });

  test('422 when the SSRF guard rejects the URL — nothing inserted', async () => {
    (validateImageUrl as jest.Mock).mockResolvedValue({ ok: false, reason: 'private' });

    await expect(media.createFromUrl('http://169.254.169.254/', 'user1')).rejects.toMatchObject({ statusCode: 422, code: 'INVALID_MEDIA_URL' });
    expect(col.insertOne).not.toHaveBeenCalled();
  });

  test('400 when url is missing', async () => {
    await expect(media.createFromUrl(undefined, 'user1')).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('createMedia dispatch', () => {
  test('400 INVALID_MEDIA_SOURCE for an unknown source', async () => {
    await expect(media.createMedia({ source: 'wormhole' }, 'user1')).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_MEDIA_SOURCE' });
  });
});

describe('deleteMedia', () => {
  test('deletes the S3 object AND the record for a source:upload item', async () => {
    col.findOne.mockResolvedValue({ _id: 'x', source: 'upload', url: 'https://d1abc.cloudfront.net/media/x.jpg' });

    await media.deleteMedia('507f1f77bcf86cd799439011');

    expect(keyFromCdnUrl).toHaveBeenCalledWith('https://d1abc.cloudfront.net/media/x.jpg');
    expect(deleteObject).toHaveBeenCalledWith('key-of-https://d1abc.cloudfront.net/media/x.jpg');
    expect(col.deleteOne).toHaveBeenCalled();
  });

  test('deletes only the record (no S3 call) for a source:url item', async () => {
    col.findOne.mockResolvedValue({ _id: 'x', source: 'url', url: 'https://external.example/p.jpg' });

    await media.deleteMedia('507f1f77bcf86cd799439011');

    expect(deleteObject).not.toHaveBeenCalled();
    expect(col.deleteOne).toHaveBeenCalled();
  });

  test('404 when the media does not exist', async () => {
    col.findOne.mockResolvedValue(null);
    await expect(media.deleteMedia('507f1f77bcf86cd799439011')).rejects.toMatchObject({ statusCode: 404, code: 'MEDIA_NOT_FOUND' });
    expect(col.deleteOne).not.toHaveBeenCalled();
  });
});
