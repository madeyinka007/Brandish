// Automocking services/media executes the real module to read its shape, which imports
// lib/mongodb and would open a live Mongo connection at import — mock it first.
jest.mock('../../lib/mongodb', () => ({ getDb: jest.fn() }));
jest.mock('../../services/media');

import { AppError } from '../../lib/errors';
import * as mediaService from '../../services/media';
import * as mediaController from '../../controllers/media';

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => jest.clearAllMocks());

describe('listMedia controller', () => {
  test('parses page/limit and 200s', async () => {
    (mediaService.listMedia as jest.Mock).mockResolvedValue([{ _id: '1' }]);
    const req: any = { query: { page: '2', limit: '5' } };
    const res = mockRes();

    mediaController.listMedia(req, res, jest.fn());
    await flush();

    expect(mediaService.listMedia).toHaveBeenCalledWith(2, 5);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('createMedia controller', () => {
  test('passes the body + userId and 201s (service does the source dispatch)', async () => {
    (mediaService.createMedia as jest.Mock).mockResolvedValue({ _id: 'm1' });
    const req: any = { user: { userId: 'u1' }, body: { source: 'url', url: 'https://x/y.jpg' } };
    const res = mockRes();

    mediaController.createMedia(req, res, jest.fn());
    await flush();

    expect(mediaService.createMedia).toHaveBeenCalledWith({ source: 'url', url: 'https://x/y.jpg' }, 'u1');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('forwards a service error (e.g. 422 SSRF reject) to next()', async () => {
    const err = new AppError(422, 'INVALID_MEDIA_URL', 'nope');
    (mediaService.createMedia as jest.Mock).mockRejectedValue(err);
    const req: any = { user: { userId: 'u1' }, body: {} };
    const res = mockRes();
    const next = jest.fn();

    mediaController.createMedia(req, res, next);
    await flush();

    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('deleteMedia controller', () => {
  test('deletes and 200s with a message', async () => {
    (mediaService.deleteMedia as jest.Mock).mockResolvedValue(undefined);
    const req: any = { params: { id: 'm1' } };
    const res = mockRes();

    mediaController.deleteMedia(req, res, jest.fn());
    await flush();

    expect(mediaService.deleteMedia).toHaveBeenCalledWith('m1');
    expect(res.json).toHaveBeenCalledWith({ message: 'Media deleted' });
  });
});
