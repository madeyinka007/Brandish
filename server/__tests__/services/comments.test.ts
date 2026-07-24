// sanitize-html's transitive ESM deps (escape-string-regexp v5) aren't transformed by ts-jest;
// stub it with a plain tag-stripper. Real HTML sanitisation is the trusted lib's concern —
// here we only assert the service strips markup and rejects an empty result.
jest.mock('sanitize-html', () => ({ __esModule: true, default: (s: string) => String(s).replace(/<[^>]*>/g, '') }));
jest.mock('../../lib/mongoose', () => ({ dbConnect: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/models/Comment', () => {
  const actual = jest.requireActual('../../lib/models/Comment');
  return { ...actual, getCommentModel: jest.fn() };
});
jest.mock('../../lib/ses', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

import { getCommentModel } from '../../lib/models/Comment';
import { sendEmail } from '../../lib/ses';
import * as comments from '../../services/comments';

let model: { find: jest.Mock; create: jest.Mock; updateById: jest.Mock; delete: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.ADMIN_ALERT_EMAIL;
  model = {
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    updateById: jest.fn(),
    delete: jest.fn(),
  };
  (getCommentModel as jest.Mock).mockResolvedValue(model);
});

describe('listComments', () => {
  test('no status → returns all, newest first', async () => {
    model.find.mockResolvedValue([{ _id: 'c1' }]);
    const result = await comments.listComments();
    expect(model.find).toHaveBeenCalledWith({}, expect.objectContaining({ sort: '-createdAt' }));
    expect(result).toEqual([{ _id: 'c1' }]);
  });

  test('valid status → filters by that status', async () => {
    await comments.listComments('pending');
    expect(model.find).toHaveBeenCalledWith({ status: 'pending' }, expect.objectContaining({ sort: '-createdAt' }));
  });

  test('unknown status is ignored (returns all)', async () => {
    await comments.listComments('bogus');
    expect(model.find).toHaveBeenCalledWith({}, expect.anything());
  });
});

describe('listApprovedByPost', () => {
  test('filters to approved comments for the post, oldest first', async () => {
    await comments.listApprovedByPost('post1');
    expect(model.find).toHaveBeenCalledWith({ postId: 'post1', status: 'approved' }, expect.objectContaining({ sort: 'createdAt' }));
  });

  test('400 when postId is missing', async () => {
    await expect(comments.listApprovedByPost('')).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_COMMENT_INPUT' });
  });
});

describe('createComment', () => {
  const valid = { postId: '507f1f77bcf86cd799439011', authorName: 'Ada', authorEmail: 'Ada@Example.com', body: 'Nice post' };

  test('stores plain-text body (HTML stripped), pending status, normalized email + ip', async () => {
    model.create.mockImplementation(async (doc: any) => ({ _id: 'c1', ...doc }));
    const result = await comments.createComment(
      { ...valid, body: 'Nice <b>post</b>' },
      '10.0.0.1',
    );
    const doc = model.create.mock.calls[0][0];
    expect(doc.body).toBe('Nice post');
    expect(doc.body).not.toMatch(/</);
    expect(doc.status).toBe('pending');
    expect(doc.authorEmail).toBe('ada@example.com');
    expect(doc.ip).toBe('10.0.0.1');
    expect(result).toMatchObject({ _id: 'c1' });
  });

  test('400 on invalid email', async () => {
    await expect(comments.createComment({ ...valid, authorEmail: 'nope' }, '')).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_COMMENT_INPUT' });
    expect(model.create).not.toHaveBeenCalled();
  });

  test('400 when body is only markup (empty after strip)', async () => {
    await expect(comments.createComment({ ...valid, body: '<b></b>' }, '')).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_COMMENT_INPUT' });
    expect(model.create).not.toHaveBeenCalled();
  });

  test('400 INVALID_COMMENT_INPUT on a bad postId (CastError)', async () => {
    model.create.mockRejectedValue(Object.assign(new Error('cast'), { name: 'CastError' }));
    await expect(comments.createComment(valid, '')).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_COMMENT_INPUT' });
  });

  test('sends the moderation alert when ADMIN_ALERT_EMAIL is set', async () => {
    process.env.ADMIN_ALERT_EMAIL = 'mods@brandish.co';
    model.create.mockResolvedValue({ _id: 'c1' });
    await comments.createComment(valid, '');
    expect(sendEmail).toHaveBeenCalledWith('mods@brandish.co', expect.any(String), expect.any(String));
  });

  test('a failed alert does not fail the submission', async () => {
    process.env.ADMIN_ALERT_EMAIL = 'mods@brandish.co';
    model.create.mockResolvedValue({ _id: 'c1' });
    (sendEmail as jest.Mock).mockRejectedValue(new Error('SES down'));
    await expect(comments.createComment(valid, '')).resolves.toMatchObject({ _id: 'c1' });
  });

  test('no alert attempted when ADMIN_ALERT_EMAIL is unset', async () => {
    model.create.mockResolvedValue({ _id: 'c1' });
    await comments.createComment(valid, '');
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe('setStatus', () => {
  test('approves a comment', async () => {
    model.updateById.mockResolvedValue({ _id: 'c1', status: 'approved' });
    const result = await comments.setStatus('c1', 'approved');
    expect(model.updateById).toHaveBeenCalledWith('c1', { status: 'approved' });
    expect(result).toMatchObject({ status: 'approved' });
  });

  test('rejects (spam) a comment', async () => {
    model.updateById.mockResolvedValue({ _id: 'c1' });
    await comments.setStatus('c1', 'rejected');
    expect(model.updateById).toHaveBeenCalledWith('c1', { status: 'rejected' });
  });

  test('400 on an invalid status', async () => {
    await expect(comments.setStatus('c1', 'spam')).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_COMMENT_STATUS' });
    expect(model.updateById).not.toHaveBeenCalled();
  });

  test('404 when the comment does not exist', async () => {
    model.updateById.mockResolvedValue(null);
    await expect(comments.setStatus('ghost', 'approved')).rejects.toMatchObject({ statusCode: 404, code: 'COMMENT_NOT_FOUND' });
  });
});

describe('deleteComment', () => {
  test('hard-deletes and resolves', async () => {
    model.delete.mockResolvedValue({ _id: 'c1' });
    await expect(comments.deleteComment('c1')).resolves.toBeUndefined();
    expect(model.delete).toHaveBeenCalledWith('c1');
  });

  test('404 when nothing was deleted', async () => {
    model.delete.mockResolvedValue(null);
    await expect(comments.deleteComment('ghost')).rejects.toMatchObject({ statusCode: 404, code: 'COMMENT_NOT_FOUND' });
  });
});
