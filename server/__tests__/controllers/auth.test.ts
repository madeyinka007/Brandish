// Automocking services/auth loads its real module chain (→ lib/models/User → lib/mongoose),
// whose top-level mongoose.connect() would otherwise run — mock it first.
jest.mock('../../lib/mongoose', () => ({ dbConnect: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../services/auth');

import { AppError } from '../../lib/errors';
import * as authService from '../../services/auth';
import * as authController from '../../controllers/auth';

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// asyncHandler doesn't return its inner promise (it .catch()es to next), so let the
// microtask queue drain before asserting.
const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('login controller', () => {
  test('passes body through to the service and 200s with its result', async () => {
    const result = { accessToken: 'a', refreshToken: 'r', user: { _id: 'u1' } };
    (authService.login as jest.Mock).mockResolvedValue(result);
    const req: any = { body: { email: 'a@b.com', password: 'pw' } };
    const res = mockRes();
    const next = jest.fn();

    authController.login(req, res, next);
    await flush();

    expect(authService.login).toHaveBeenCalledWith('a@b.com', 'pw');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
    expect(next).not.toHaveBeenCalled();
  });

  test('forwards a thrown service error to next() (for the error middleware)', async () => {
    const err = new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    (authService.login as jest.Mock).mockRejectedValue(err);
    const req: any = { body: {} };
    const res = mockRes();
    const next = jest.fn();

    authController.login(req, res, next);
    await flush();

    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('refresh controller', () => {
  test('passes the refresh token and 200s with the new pair', async () => {
    (authService.refresh as jest.Mock).mockResolvedValue({ accessToken: 'a2', refreshToken: 'r2' });
    const req: any = { body: { refreshToken: 'r1' } };
    const res = mockRes();

    authController.refresh(req, res, jest.fn());
    await flush();

    expect(authService.refresh).toHaveBeenCalledWith('r1');
    expect(res.json).toHaveBeenCalledWith({ accessToken: 'a2', refreshToken: 'r2' });
  });
});

describe('logout controller', () => {
  test('calls the service and returns a message', async () => {
    (authService.logout as jest.Mock).mockResolvedValue(undefined);
    const req: any = { body: { refreshToken: 'r1' } };
    const res = mockRes();

    authController.logout(req, res, jest.fn());
    await flush();

    expect(authService.logout).toHaveBeenCalledWith('r1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Logged out' });
  });
});

describe('forgotPassword controller', () => {
  test('returns the same generic message regardless of outcome', async () => {
    (authService.forgotPassword as jest.Mock).mockResolvedValue(undefined);
    const req: any = { body: { email: 'a@b.com' } };
    const res = mockRes();

    authController.forgotPassword(req, res, jest.fn());
    await flush();

    expect(authService.forgotPassword).toHaveBeenCalledWith('a@b.com');
    expect(res.json).toHaveBeenCalledWith({ message: expect.stringContaining('reset link') });
  });
});

describe('resetPassword controller', () => {
  test('passes token + newPassword through', async () => {
    (authService.resetPassword as jest.Mock).mockResolvedValue(undefined);
    const req: any = { body: { token: 't', newPassword: 'newpassword' } };
    const res = mockRes();

    authController.resetPassword(req, res, jest.fn());
    await flush();

    expect(authService.resetPassword).toHaveBeenCalledWith('t', 'newpassword');
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('changePassword controller', () => {
  test('reads userId from req.user and passes the passwords', async () => {
    (authService.changePassword as jest.Mock).mockResolvedValue(undefined);
    const req: any = { user: { userId: 'u1' }, body: { currentPassword: 'old', newPassword: 'newpassword' } };
    const res = mockRes();

    authController.changePassword(req, res, jest.fn());
    await flush();

    expect(authService.changePassword).toHaveBeenCalledWith('u1', 'old', 'newpassword');
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('verifyEmail controller', () => {
  test('accepts the token from the body', async () => {
    (authService.verifyEmail as jest.Mock).mockResolvedValue(undefined);
    const req: any = { body: { token: 'vt' }, query: {} };
    const res = mockRes();

    authController.verifyEmail(req, res, jest.fn());
    await flush();

    expect(authService.verifyEmail).toHaveBeenCalledWith('vt');
  });

  test('falls back to the query string token', async () => {
    (authService.verifyEmail as jest.Mock).mockResolvedValue(undefined);
    const req: any = { body: {}, query: { token: 'qt' } };
    const res = mockRes();

    authController.verifyEmail(req, res, jest.fn());
    await flush();

    expect(authService.verifyEmail).toHaveBeenCalledWith('qt');
  });
});

describe('resendVerification controller', () => {
  test('returns the generic message', async () => {
    (authService.resendVerification as jest.Mock).mockResolvedValue(undefined);
    const req: any = { body: { email: 'a@b.com' } };
    const res = mockRes();

    authController.resendVerification(req, res, jest.fn());
    await flush();

    expect(authService.resendVerification).toHaveBeenCalledWith('a@b.com');
    expect(res.json).toHaveBeenCalledWith({ message: expect.stringContaining('verification link') });
  });
});
