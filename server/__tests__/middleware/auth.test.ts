import { signAccessToken } from '../../lib/jwt';
import { requireAuth, requireRole } from '../../middleware/auth';

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret';
});

describe('requireAuth', () => {
  test('401 NO_SESSION when there is no Authorization header', () => {
    const req: any = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized', code: 'NO_SESSION' });
    expect(next).not.toHaveBeenCalled();
  });

  test('401 NO_SESSION when the header is not a Bearer token', () => {
    const req: any = { headers: { authorization: 'Basic abc' } };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized', code: 'NO_SESSION' });
  });

  test('401 INVALID_TOKEN when the Bearer token fails verification', () => {
    const req: any = { headers: { authorization: 'Bearer not-a-real-jwt' } };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
    expect(next).not.toHaveBeenCalled();
  });

  test('attaches the decoded payload as req.user and calls next() on a valid token', () => {
    const token = signAccessToken({ userId: 'u1', role: 'editor', email: 'a@b.com' });
    const req: any = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(req.user).toEqual({ userId: 'u1', role: 'editor', email: 'a@b.com' });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('requireRole', () => {
  test('403 INSUFFICIENT_ROLE when req.user.role is not in the allowed list', () => {
    const req: any = { user: { role: 'author' } };
    const res = mockRes();
    const next = jest.fn();

    requireRole('editor', 'super-admin')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden', code: 'INSUFFICIENT_ROLE' });
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next() when req.user.role is in the allowed list', () => {
    const req: any = { user: { role: 'editor' } };
    const res = mockRes();
    const next = jest.fn();

    requireRole('editor', 'super-admin')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('403 when there is no req.user at all', () => {
    const req: any = {};
    const res = mockRes();
    const next = jest.fn();

    requireRole('editor')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
