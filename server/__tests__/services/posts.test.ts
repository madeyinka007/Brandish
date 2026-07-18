// lib/mongoose connects at import time — mock it so importing the Post model chain (and the
// real uniqueSlug it backs) makes no real connection. The Post/User models, revalidate and
// auditLog are all mocked so this stays a pure unit test with no DB/AWS/network access.
jest.mock('../../lib/mongoose', () => ({ dbConnect: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/models/Post', () => {
  const actual = jest.requireActual('../../lib/models/Post');
  return { ...actual, getPostModel: jest.fn() };
});
jest.mock('../../lib/models/User', () => ({ getUserModel: jest.fn() }));
jest.mock('../../lib/revalidate', () => ({
  revalidatePost: jest.fn().mockResolvedValue(undefined),
  purgePost: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../lib/auditLog', () => ({ logAudit: jest.fn().mockResolvedValue(undefined) }));

import { getPostModel } from '../../lib/models/Post';
import { getUserModel } from '../../lib/models/User';
import { revalidatePost, purgePost } from '../../lib/revalidate';
import { logAudit } from '../../lib/auditLog';
import * as posts from '../../services/posts';

let postModel: {
  exists: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
  findById: jest.Mock;
  create: jest.Mock;
  updateById: jest.Mock;
  delete: jest.Mock;
  paginate: jest.Mock;
};
let userModel: { findById: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  postModel = {
    exists: jest.fn().mockResolvedValue(false),
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    updateById: jest.fn(),
    delete: jest.fn(),
    paginate: jest.fn(),
  };
  userModel = { findById: jest.fn().mockResolvedValue({ _id: 'u1', name: 'Jane', avatar: 'a.png' }) };
  (getPostModel as jest.Mock).mockResolvedValue(postModel);
  (getUserModel as jest.Mock).mockResolvedValue(userModel);
});

describe('createPost', () => {
  test('generates the slug server-side, embeds the author, defaults to draft', async () => {
    postModel.create.mockImplementation(async (doc: any) => ({ ...doc, _id: 'p1' }));

    const post = await posts.createPost({ title: 'Hello World', category: 'money' }, 'u1');

    const created = postModel.create.mock.calls[0][0];
    expect(created.slug).toBe('hello-world');
    expect(created.author).toEqual({ _id: 'u1', name: 'Jane', avatar: 'a.png' });
    expect(created.status).toBe('draft');
    expect(created.publishedAt).toBeNull();
    expect(post).toMatchObject({ _id: 'p1', slug: 'hello-world' });
    expect(revalidatePost).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  test('a post born published sets publishedAt, revalidates, and audits the publish', async () => {
    postModel.create.mockImplementation(async (doc: any) => ({ ...doc, _id: 'p1' }));

    await posts.createPost({ title: 'Live', category: 'money', status: 'published' }, 'u1');

    const created = postModel.create.mock.calls[0][0];
    expect(created.publishedAt).toBeInstanceOf(Date);
    expect(revalidatePost).toHaveBeenCalledWith(expect.objectContaining({ _id: 'p1' }));
    expect(logAudit).toHaveBeenCalledWith('post.publish', 'post', 'p1', 'u1', expect.any(Object));
  });

  test('422 when format is "gallery" but media is empty — never reaches create', async () => {
    await expect(posts.createPost({ title: 'G', category: 'money', format: 'gallery' }, 'u1')).rejects.toMatchObject({
      statusCode: 422,
      code: 'GALLERY_MEDIA_REQUIRED',
    });
    expect(postModel.create).not.toHaveBeenCalled();
  });

  test('422 when format is "video" but videoId is missing — never reaches create', async () => {
    await expect(posts.createPost({ title: 'V', category: 'money', format: 'video' }, 'u1')).rejects.toMatchObject({
      statusCode: 422,
      code: 'VIDEO_ID_REQUIRED',
    });
    expect(postModel.create).not.toHaveBeenCalled();
  });

  test('a gallery with media and a video with a videoId both pass', async () => {
    postModel.create.mockImplementation(async (doc: any) => ({ ...doc, _id: 'p1' }));
    await expect(
      posts.createPost({ title: 'G', category: 'money', format: 'gallery', media: ['https://x/y.jpg'] }, 'u1'),
    ).resolves.toBeDefined();
    await expect(
      posts.createPost({ title: 'V', category: 'money', format: 'video', videoId: 'abc123' }, 'u1'),
    ).resolves.toBeDefined();
  });

  test('400 when title or category is missing', async () => {
    await expect(posts.createPost({ category: 'money' }, 'u1')).rejects.toMatchObject({ statusCode: 400 });
    await expect(posts.createPost({ title: 'X' }, 'u1')).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('updatePost', () => {
  const draft = {
    _id: 'p1',
    slug: 'old',
    title: 't',
    excerpt: '',
    category: 'money',
    format: 'article' as const,
    media: [] as string[],
    videoId: null,
    status: 'draft' as const,
    publishedAt: null,
  };

  test('regenerates + de-duplicates the slug (excluding self) when it is edited', async () => {
    postModel.findById.mockResolvedValue({ ...draft });
    postModel.exists.mockResolvedValue(false);
    postModel.updateById.mockResolvedValue({ ...draft, slug: 'new-slug' });

    await posts.updatePost('p1', { slug: 'New Slug' }, 'u1');

    expect(postModel.exists).toHaveBeenCalledWith({ slug: 'new-slug', _id: { $ne: 'p1' } });
    expect(postModel.updateById.mock.calls[0][1]).toMatchObject({ slug: 'new-slug' });
  });

  test('publish transition sets publishedAt, revalidates, and audits', async () => {
    postModel.findById.mockResolvedValue({ ...draft });
    postModel.updateById.mockResolvedValue({ ...draft, status: 'published' });

    await posts.updatePost('p1', { status: 'published' }, 'u1');

    expect(postModel.updateById.mock.calls[0][1].publishedAt).toBeInstanceOf(Date);
    expect(revalidatePost).toHaveBeenCalled();
    expect(logAudit).toHaveBeenCalledWith('post.publish', 'post', 'p1', 'u1', expect.any(Object));
  });

  test('422 when switching to gallery without supplying media (effective shape has none)', async () => {
    postModel.findById.mockResolvedValue({ ...draft });
    await expect(posts.updatePost('p1', { format: 'gallery' }, 'u1')).rejects.toMatchObject({
      statusCode: 422,
      code: 'GALLERY_MEDIA_REQUIRED',
    });
    expect(postModel.updateById).not.toHaveBeenCalled();
  });

  test('404 when the post does not exist', async () => {
    postModel.findById.mockResolvedValue(null);
    await expect(posts.updatePost('ghost', { title: 'X' }, 'u1')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('deletePost', () => {
  test('deletes, purges the cache, and audits', async () => {
    const existing = { _id: 'p1', slug: 'p', category: 'money', title: 't', excerpt: '' };
    postModel.findById.mockResolvedValue(existing);
    postModel.delete.mockResolvedValue(existing);

    await expect(posts.deletePost('p1', 'u1')).resolves.toBeUndefined();

    expect(postModel.delete).toHaveBeenCalledWith('p1');
    expect(purgePost).toHaveBeenCalledWith(existing);
    expect(logAudit).toHaveBeenCalledWith('post.delete', 'post', 'p1', 'u1', expect.any(Object));
  });

  test('404 when the post does not exist — nothing purged', async () => {
    postModel.findById.mockResolvedValue(null);
    await expect(posts.deletePost('ghost', 'u1')).rejects.toMatchObject({ statusCode: 404 });
    expect(purgePost).not.toHaveBeenCalled();
  });
});

describe('reads', () => {
  test('listPublicPosts filters to published, newest first', async () => {
    postModel.paginate.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });
    await posts.listPublicPosts({ category: 'money', page: 1, limit: 10 });
    expect(postModel.paginate).toHaveBeenCalledWith(
      { status: 'published', category: 'money' },
      expect.objectContaining({ sort: '-publishedAt', page: 1, limit: 10 }),
    );
  });

  test('getPublishedBySlug 404s when no published post matches', async () => {
    postModel.findOne.mockResolvedValue(null);
    await expect(posts.getPublishedBySlug('ghost')).rejects.toMatchObject({ statusCode: 404, code: 'POST_NOT_FOUND' });
    expect(postModel.findOne).toHaveBeenCalledWith({ slug: 'ghost', status: 'published' });
  });
});
