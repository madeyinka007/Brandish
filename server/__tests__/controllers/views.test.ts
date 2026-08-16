// Factory mock (not automock) so the real service — and its lib/dynamo + lib/mongodb deps —
// are never loaded in this controller-only test.
jest.mock('../../services/views', () => ({ recordView: jest.fn() }));

import * as viewsService from '../../services/views';
import * as viewsController from '../../controllers/views';

function mockRes() {
  return { status: jest.fn().mockReturnThis(), end: jest.fn(), json: jest.fn() } as any;
}
const flush = () => new Promise((r) => setImmediate(r));

function mockReq(over: any = {}) {
  const headers: Record<string, string> = over.headers ?? {};
  return {
    params: over.params ?? { id: 'p1' },
    body: over.body ?? {},
    headers,
    ip: over.ip ?? '',
    get: (name: string) => headers[name.toLowerCase()],
  } as any;
}

beforeEach(() => {
  jest.clearAllMocks();
  (viewsService.recordView as jest.Mock).mockResolvedValue(true);
});

describe('recordView controller', () => {
  test('derives client ip from x-forwarded-for and 204s', async () => {
    const req = mockReq({
      params: { id: 'post-1' },
      headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1', 'user-agent': 'UA/1' },
    });
    const res = mockRes();
    viewsController.recordView(req, res, jest.fn());
    await flush();

    expect(viewsService.recordView).toHaveBeenCalledWith('post-1', expect.objectContaining({ ip: '9.9.9.9', userAgent: 'UA/1' }));
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
  });

  test('prefers body.referrer (the real source) over the Referer header', async () => {
    const req = mockReq({
      body: { referrer: 'https://t.co/abc' },
      headers: { referer: 'https://brandish.com.ng/some/post' },
    });
    viewsController.recordView(req, mockRes(), jest.fn());
    await flush();
    expect(viewsService.recordView).toHaveBeenCalledWith('p1', expect.objectContaining({ referrer: 'https://t.co/abc' }));
  });

  test('falls back to the Referer header when body has no referrer', async () => {
    const req = mockReq({ headers: { referer: 'https://google.com/' } });
    viewsController.recordView(req, mockRes(), jest.fn());
    await flush();
    expect(viewsService.recordView).toHaveBeenCalledWith('p1', expect.objectContaining({ referrer: 'https://google.com/' }));
  });

  test('referrer is null when neither body nor header provides one', async () => {
    viewsController.recordView(mockReq(), mockRes(), jest.fn());
    await flush();
    expect(viewsService.recordView).toHaveBeenCalledWith('p1', expect.objectContaining({ referrer: null }));
  });

  test('swallows a service failure and still 204s (tracking never breaks the page)', async () => {
    (viewsService.recordView as jest.Mock).mockRejectedValue(new Error('db down'));
    const res = mockRes();
    viewsController.recordView(mockReq(), res, jest.fn());
    await flush();
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
