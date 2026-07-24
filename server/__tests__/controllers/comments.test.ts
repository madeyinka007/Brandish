// Auto-mocking the service still loads it (to read its shape), which imports sanitize-html —
// whose transitive ESM deps ts-jest won't transform. Stub it so the module graph loads.
jest.mock('sanitize-html', () => ({ __esModule: true, default: (s: string) => String(s) }));
jest.mock('../../lib/mongoose', () => ({ dbConnect: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../services/comments');

import { AppError } from '../../lib/errors';
import * as commentsService from '../../services/comments';
import * as commentsController from '../../controllers/comments';

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => jest.clearAllMocks());

describe('listComments controller (admin)', () => {
  test('passes the status query through and 200s', async () => {
    (commentsService.listComments as jest.Mock).mockResolvedValue([{ _id: 'c1' }]);
    const res = mockRes();
    commentsController.listComments({ query: { status: 'pending' } } as any, res, jest.fn());
    await flush();
    expect(commentsService.listComments).toHaveBeenCalledWith('pending');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ _id: 'c1' }]);
  });
});

describe('moderateComment controller', () => {
  test('passes id + status and 200s', async () => {
    (commentsService.setStatus as jest.Mock).mockResolvedValue({ _id: 'c1', status: 'approved' });
    const req: any = { params: { id: 'c1' }, body: { status: 'approved' } };
    const res = mockRes();
    commentsController.moderateComment(req, res, jest.fn());
    await flush();
    expect(commentsService.setStatus).toHaveBeenCalledWith('c1', 'approved');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('forwards a service error to next()', async () => {
    const err = new AppError(404, 'COMMENT_NOT_FOUND', 'nope');
    (commentsService.setStatus as jest.Mock).mockRejectedValue(err);
    const res = mockRes();
    const next = jest.fn();
    commentsController.moderateComment({ params: { id: 'x' }, body: {} } as any, res, next);
    await flush();
    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('deleteComment controller', () => {
  test('deletes and 200s with a message', async () => {
    (commentsService.deleteComment as jest.Mock).mockResolvedValue(undefined);
    const res = mockRes();
    commentsController.deleteComment({ params: { id: 'c1' } } as any, res, jest.fn());
    await flush();
    expect(commentsService.deleteComment).toHaveBeenCalledWith('c1');
    expect(res.json).toHaveBeenCalledWith({ message: 'Comment deleted' });
  });
});

describe('listPublic controller', () => {
  test('passes postId and 200s', async () => {
    (commentsService.listApprovedByPost as jest.Mock).mockResolvedValue([{ _id: 'c1' }]);
    const res = mockRes();
    commentsController.listPublic({ query: { postId: 'p1' } } as any, res, jest.fn());
    await flush();
    expect(commentsService.listApprovedByPost).toHaveBeenCalledWith('p1');
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('createComment controller', () => {
  test('derives client ip from x-forwarded-for and 201s', async () => {
    (commentsService.createComment as jest.Mock).mockResolvedValue({ _id: 'c1' });
    const req: any = {
      body: { postId: 'p1', authorName: 'Ada', authorEmail: 'ada@x.co', body: 'hi' },
      headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' },
    };
    const res = mockRes();
    commentsController.createComment(req, res, jest.fn());
    await flush();
    expect(commentsService.createComment).toHaveBeenCalledWith(
      { postId: 'p1', authorName: 'Ada', authorEmail: 'ada@x.co', body: 'hi' },
      '9.9.9.9',
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
