// Automocking services/posts loads its chain (→ slug → Post model → lib/mongoose, and
// → auditLog → lib/mongodb), whose top-level connects would otherwise run — mock both first.
jest.mock('../../lib/mongoose', () => ({ dbConnect: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/mongodb', () => ({ getDb: jest.fn() }));
jest.mock('../../services/posts');

import { AppError } from '../../lib/errors';
import * as postsService from '../../services/posts';
import * as postsController from '../../controllers/posts';

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => jest.clearAllMocks());

describe('list controller (public)', () => {
  test('passes category + pagination and 200s', async () => {
    (postsService.listPublicPosts as jest.Mock).mockResolvedValue({ data: [] });
    const req: any = { query: { category: 'money', page: '2', limit: '5' } };
    const res = mockRes();
    postsController.list(req, res, jest.fn());
    await flush();
    expect(postsService.listPublicPosts).toHaveBeenCalledWith({ category: 'money', page: 2, limit: 5 });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('getBySlug controller (public)', () => {
  test('200s with the post', async () => {
    (postsService.getPublishedBySlug as jest.Mock).mockResolvedValue({ slug: 'p' });
    const req: any = { params: { slug: 'p' } };
    const res = mockRes();
    postsController.getBySlug(req, res, jest.fn());
    await flush();
    expect(postsService.getPublishedBySlug).toHaveBeenCalledWith('p');
    expect(res.json).toHaveBeenCalledWith({ slug: 'p' });
  });

  test('forwards a 404 to next()', async () => {
    const err = new AppError(404, 'POST_NOT_FOUND', 'nope');
    (postsService.getPublishedBySlug as jest.Mock).mockRejectedValue(err);
    const req: any = { params: { slug: 'ghost' } };
    const res = mockRes();
    const next = jest.fn();
    postsController.getBySlug(req, res, next);
    await flush();
    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('createPost controller (admin)', () => {
  test('passes the body + the acting user id and 201s', async () => {
    (postsService.createPost as jest.Mock).mockResolvedValue({ _id: 'p1' });
    const req: any = { user: { userId: 'u1' }, body: { title: 'T', category: 'money' } };
    const res = mockRes();
    postsController.createPost(req, res, jest.fn());
    await flush();
    expect(postsService.createPost).toHaveBeenCalledWith({ title: 'T', category: 'money' }, 'u1');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('forwards a service 422 to next()', async () => {
    const err = new AppError(422, 'GALLERY_MEDIA_REQUIRED', 'nope');
    (postsService.createPost as jest.Mock).mockRejectedValue(err);
    const req: any = { user: { userId: 'u1' }, body: {} };
    const res = mockRes();
    const next = jest.fn();
    postsController.createPost(req, res, next);
    await flush();
    expect(next).toHaveBeenCalledWith(err);
  });
});

describe('updatePost controller (admin)', () => {
  test('passes id, body, and acting user id', async () => {
    (postsService.updatePost as jest.Mock).mockResolvedValue({ _id: 'p1' });
    const req: any = { user: { userId: 'u1' }, params: { id: 'p1' }, body: { status: 'published' } };
    const res = mockRes();
    postsController.updatePost(req, res, jest.fn());
    await flush();
    expect(postsService.updatePost).toHaveBeenCalledWith('p1', { status: 'published' }, 'u1');
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('deletePost controller (admin)', () => {
  test('deletes and 200s with a message', async () => {
    (postsService.deletePost as jest.Mock).mockResolvedValue(undefined);
    const req: any = { user: { userId: 'u1' }, params: { id: 'p1' } };
    const res = mockRes();
    postsController.deletePost(req, res, jest.fn());
    await flush();
    expect(postsService.deletePost).toHaveBeenCalledWith('p1', 'u1');
    expect(res.json).toHaveBeenCalledWith({ message: 'Post deleted' });
  });
});
