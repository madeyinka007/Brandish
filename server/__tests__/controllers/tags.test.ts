jest.mock('../../lib/mongoose', () => ({ dbConnect: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../services/tags');

import { AppError } from '../../lib/errors';
import * as tagsService from '../../services/tags';
import * as tagsController from '../../controllers/tags';

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => jest.clearAllMocks());

describe('listTags controller', () => {
  test('200s with the tags', async () => {
    (tagsService.listTags as jest.Mock).mockResolvedValue([{ slug: 'fintech' }]);
    const res = mockRes();
    tagsController.listTags({} as any, res, jest.fn());
    await flush();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ slug: 'fintech' }]);
  });
});

describe('createTag controller', () => {
  test('passes req.body.name and 201s', async () => {
    (tagsService.createTag as jest.Mock).mockResolvedValue({ _id: 't1' });
    const req: any = { body: { name: 'Fintech' } };
    const res = mockRes();
    tagsController.createTag(req, res, jest.fn());
    await flush();
    expect(tagsService.createTag).toHaveBeenCalledWith('Fintech');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('forwards a service error to next()', async () => {
    const err = new AppError(409, 'TAG_EXISTS', 'dup');
    (tagsService.createTag as jest.Mock).mockRejectedValue(err);
    const req: any = { body: {} };
    const res = mockRes();
    const next = jest.fn();
    tagsController.createTag(req, res, next);
    await flush();
    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('deleteTag controller', () => {
  test('deletes and 200s with a message', async () => {
    (tagsService.deleteTag as jest.Mock).mockResolvedValue(undefined);
    const req: any = { params: { id: 't1' } };
    const res = mockRes();
    tagsController.deleteTag(req, res, jest.fn());
    await flush();
    expect(tagsService.deleteTag).toHaveBeenCalledWith('t1');
    expect(res.json).toHaveBeenCalledWith({ message: 'Tag deleted' });
  });
});
