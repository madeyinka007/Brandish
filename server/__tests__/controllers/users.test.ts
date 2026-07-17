// Automocking services/users loads its real module chain (→ lib/models/User → lib/mongoose),
// whose top-level mongoose.connect() would otherwise run — mock it first.
jest.mock('../../lib/mongoose', () => ({ dbConnect: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../services/users');

import { AppError } from '../../lib/errors';
import * as usersService from '../../services/users';
import * as usersController from '../../controllers/users';

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => jest.clearAllMocks());

describe('listUsers controller', () => {
  test('parses page/limit and 200s with the service result', async () => {
    (usersService.listUsers as jest.Mock).mockResolvedValue([{ _id: 'u1' }]);
    const req: any = { query: { page: '2', limit: '5' } };
    const res = mockRes();

    usersController.listUsers(req, res, jest.fn());
    await flush();

    expect(usersService.listUsers).toHaveBeenCalledWith(2, 5);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ _id: 'u1' }]);
  });

  test('passes undefined page/limit when absent', async () => {
    (usersService.listUsers as jest.Mock).mockResolvedValue([]);
    const req: any = { query: {} };
    usersController.listUsers(req, mockRes(), jest.fn());
    await flush();
    expect(usersService.listUsers).toHaveBeenCalledWith(undefined, undefined);
  });
});

describe('createUser controller', () => {
  test('201s with the created user', async () => {
    (usersService.createUser as jest.Mock).mockResolvedValue({ _id: 'u1' });
    const req: any = { body: { name: 'A', email: 'a@b.com', password: 'pw12345678', role: 'editor' } };
    const res = mockRes();

    usersController.createUser(req, res, jest.fn());
    await flush();

    expect(usersService.createUser).toHaveBeenCalledWith({ name: 'A', email: 'a@b.com', password: 'pw12345678', role: 'editor', avatar: undefined });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('forwards a service error to next()', async () => {
    const err = new AppError(409, 'EMAIL_EXISTS', 'dup');
    (usersService.createUser as jest.Mock).mockRejectedValue(err);
    const req: any = { body: {} };
    const res = mockRes();
    const next = jest.fn();

    usersController.createUser(req, res, next);
    await flush();

    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('updateUser controller', () => {
  test('passes id + whitelisted fields', async () => {
    (usersService.updateUser as jest.Mock).mockResolvedValue({ _id: 'u1' });
    const req: any = { params: { id: 'u1' }, body: { name: 'N', email: 'e@b.com', avatar: 'a', role: 'super-admin' } };
    const res = mockRes();

    usersController.updateUser(req, res, jest.fn());
    await flush();

    // role is NOT forwarded by this controller — it has its own endpoint
    expect(usersService.updateUser).toHaveBeenCalledWith('u1', { name: 'N', email: 'e@b.com', avatar: 'a' });
  });
});

describe('assignRole controller', () => {
  test('passes id + role from the body', async () => {
    (usersService.assignRole as jest.Mock).mockResolvedValue({ _id: 'u1' });
    const req: any = { params: { id: 'u1' }, body: { role: 'editor' } };
    const res = mockRes();

    usersController.assignRole(req, res, jest.fn());
    await flush();

    expect(usersService.assignRole).toHaveBeenCalledWith('u1', 'editor');
  });
});

describe('setStatus controller', () => {
  test('passes id + active from the body', async () => {
    (usersService.setStatus as jest.Mock).mockResolvedValue({ _id: 'u1' });
    const req: any = { params: { id: 'u1' }, body: { active: false } };
    const res = mockRes();

    usersController.setStatus(req, res, jest.fn());
    await flush();

    expect(usersService.setStatus).toHaveBeenCalledWith('u1', false);
  });
});

describe('deleteUser controller', () => {
  test('deletes and 200s with a message', async () => {
    (usersService.deleteUser as jest.Mock).mockResolvedValue(undefined);
    const req: any = { params: { id: 'u1' } };
    const res = mockRes();

    usersController.deleteUser(req, res, jest.fn());
    await flush();

    expect(usersService.deleteUser).toHaveBeenCalledWith('u1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'User deleted' });
  });
});
