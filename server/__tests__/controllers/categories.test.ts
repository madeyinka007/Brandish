// Automocking services/categories loads its chain (→ Category model → lib/mongoose),
// whose top-level connect would otherwise run — mock it first.
jest.mock('../../lib/mongoose', () => ({ dbConnect: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../services/categories');

import { AppError } from '../../lib/errors';
import * as categoriesService from '../../services/categories';
import * as categoriesController from '../../controllers/categories';

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => jest.clearAllMocks());

describe('listPublic controller', () => {
  test('200s with the active categories', async () => {
    (categoriesService.listPublic as jest.Mock).mockResolvedValue([{ slug: 'money' }]);
    const res = mockRes();
    categoriesController.listPublic({} as any, res, jest.fn());
    await flush();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ slug: 'money' }]);
  });
});

describe('listAll controller', () => {
  test('delegates to listAll', async () => {
    (categoriesService.listAll as jest.Mock).mockResolvedValue([]);
    const res = mockRes();
    categoriesController.listAll({} as any, res, jest.fn());
    await flush();
    expect(categoriesService.listAll).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('createCategory controller', () => {
  test('201s with the created category', async () => {
    (categoriesService.createCategory as jest.Mock).mockResolvedValue({ _id: 'c1' });
    const req: any = { body: { name: 'Tech', color: '#000', order: 1, status: 'active', seo: {} } };
    const res = mockRes();
    categoriesController.createCategory(req, res, jest.fn());
    await flush();
    expect(categoriesService.createCategory).toHaveBeenCalledWith({ name: 'Tech', description: undefined, color: '#000', order: 1, status: 'active', seo: {} });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('forwards a service error to next()', async () => {
    const err = new AppError(409, 'NAME_EXISTS', 'dup');
    (categoriesService.createCategory as jest.Mock).mockRejectedValue(err);
    const req: any = { body: {} };
    const res = mockRes();
    const next = jest.fn();
    categoriesController.createCategory(req, res, next);
    await flush();
    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('updateCategory controller', () => {
  test('passes id + the whole body through (service does the whitelisting)', async () => {
    (categoriesService.updateCategory as jest.Mock).mockResolvedValue({ _id: 'c1' });
    const req: any = { params: { id: 'c1' }, body: { name: 'N', slug: 'ignored' } };
    const res = mockRes();
    categoriesController.updateCategory(req, res, jest.fn());
    await flush();
    expect(categoriesService.updateCategory).toHaveBeenCalledWith('c1', { name: 'N', slug: 'ignored' });
  });
});

describe('deleteCategory controller', () => {
  test('deletes and 200s with a message', async () => {
    (categoriesService.deleteCategory as jest.Mock).mockResolvedValue(undefined);
    const req: any = { params: { id: 'c1' } };
    const res = mockRes();
    categoriesController.deleteCategory(req, res, jest.fn());
    await flush();
    expect(categoriesService.deleteCategory).toHaveBeenCalledWith('c1');
    expect(res.json).toHaveBeenCalledWith({ message: 'Category deleted' });
  });
});

describe('reorder controller', () => {
  test('passes req.body.items', async () => {
    (categoriesService.reorder as jest.Mock).mockResolvedValue(undefined);
    const req: any = { body: { items: [{ id: 'a', order: 0 }] } };
    const res = mockRes();
    categoriesController.reorder(req, res, jest.fn());
    await flush();
    expect(categoriesService.reorder).toHaveBeenCalledWith([{ id: 'a', order: 0 }]);
  });
});
