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

describe('listTagsWithUsage controller', () => {
  test('200s with tags including postCount', async () => {
    (tagsService.listTagsWithUsage as jest.Mock).mockResolvedValue([{ slug: 'fintech', postCount: 2 }]);
    const res = mockRes();
    tagsController.listTagsWithUsage({} as any, res, jest.fn());
    await flush();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ slug: 'fintech', postCount: 2 }]);
  });
});

describe('createTag controller', () => {
  test('passes name/description/color and 201s', async () => {
    (tagsService.createTag as jest.Mock).mockResolvedValue({ _id: 't1' });
    const req: any = { body: { name: 'Fintech', description: 'd', color: '#000' } };
    const res = mockRes();
    tagsController.createTag(req, res, jest.fn());
    await flush();
    expect(tagsService.createTag).toHaveBeenCalledWith({ name: 'Fintech', description: 'd', color: '#000' });
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

describe('updateTag controller', () => {
  test('passes id + body and 200s', async () => {
    (tagsService.updateTag as jest.Mock).mockResolvedValue({ _id: 't1', name: 'Renamed' });
    const req: any = { params: { id: 't1' }, body: { name: 'Renamed' } };
    const res = mockRes();
    tagsController.updateTag(req, res, jest.fn());
    await flush();
    expect(tagsService.updateTag).toHaveBeenCalledWith('t1', { name: 'Renamed' });
    expect(res.status).toHaveBeenCalledWith(200);
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
