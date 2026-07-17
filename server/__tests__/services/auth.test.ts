// Automocking lib/models/User loads the real module to inspect it, which pulls in
// lib/mongoose's top-level mongoose.connect() — mock it first so no real connection is made.
jest.mock('../../lib/mongoose', () => ({ dbConnect: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/models/User');
jest.mock('../../lib/password');
jest.mock('../../lib/jwt');
jest.mock('../../lib/dynamo');
jest.mock('../../lib/ses');

import { AppError } from '../../lib/errors';
import { consumeRefreshToken, revokeRefreshToken, storeRefreshToken } from '../../lib/dynamo';
import { signAccessToken } from '../../lib/jwt';
import { comparePassword, hashPassword } from '../../lib/password';
import { getUserModel, sanitizeUser } from '../../lib/models/User';
import { sendEmail } from '../../lib/ses';
import * as auth from '../../services/auth';

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'user1',
    name: 'Ada',
    email: 'ada@brandish.ng',
    passwordHash: 'hashed',
    role: 'editor',
    active: true,
    emailVerified: true,
    emailVerificationToken: null,
    passwordResetToken: null,
    passwordResetExpires: null,
    ...overrides,
  };
}

let users: {
  findOne: jest.Mock;
  findById: jest.Mock;
  updateById: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.FRONTEND_URL = 'https://brandish.ng';
  users = { findOne: jest.fn(), findById: jest.fn(), updateById: jest.fn() };
  (getUserModel as jest.Mock).mockResolvedValue(users);
  (sanitizeUser as jest.Mock).mockImplementation((u: any) => {
    const { passwordHash, emailVerificationToken, passwordResetToken, passwordResetExpires, ...rest } = u;
    return rest;
  });
  (signAccessToken as jest.Mock).mockReturnValue('access-token');
  (hashPassword as jest.Mock).mockResolvedValue('new-hash');
  (comparePassword as jest.Mock).mockResolvedValue(true);
  (storeRefreshToken as jest.Mock).mockResolvedValue(undefined);
  (sendEmail as jest.Mock).mockResolvedValue(undefined);
});

describe('login', () => {
  test('returns tokens + sanitized user on valid credentials', async () => {
    users.findOne.mockResolvedValue(makeUser());

    const result = await auth.login('ada@brandish.ng', 'password123');

    expect(result.accessToken).toBe('access-token');
    expect(typeof result.refreshToken).toBe('string');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(storeRefreshToken).toHaveBeenCalledWith(expect.any(String), 'user1', expect.any(Number));
  });

  test('400 on malformed input', async () => {
    await expect(auth.login('not-an-email', '')).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_CREDENTIALS_FORMAT' });
  });

  test('401 (generic) when the user does not exist', async () => {
    users.findOne.mockResolvedValue(null);
    await expect(auth.login('ada@brandish.ng', 'password123')).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
  });

  test('401 (generic) when the user is inactive', async () => {
    users.findOne.mockResolvedValue(makeUser({ active: false }));
    await expect(auth.login('ada@brandish.ng', 'password123')).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
  });

  test('401 (generic) on wrong password', async () => {
    users.findOne.mockResolvedValue(makeUser());
    (comparePassword as jest.Mock).mockResolvedValue(false);
    await expect(auth.login('ada@brandish.ng', 'password123')).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
  });

  test('403 EMAIL_NOT_VERIFIED when email is unverified', async () => {
    users.findOne.mockResolvedValue(makeUser({ emailVerified: false }));
    await expect(auth.login('ada@brandish.ng', 'password123')).rejects.toMatchObject({ statusCode: 403, code: 'EMAIL_NOT_VERIFIED' });
  });
});

describe('refresh (rotation)', () => {
  test('consumes the old token and issues a new pair', async () => {
    (consumeRefreshToken as jest.Mock).mockResolvedValue('user1');
    users.findById.mockResolvedValue(makeUser());

    const result = await auth.refresh('old-refresh');

    expect(consumeRefreshToken).toHaveBeenCalledWith('old-refresh');
    expect(result.accessToken).toBe('access-token');
    expect(storeRefreshToken).toHaveBeenCalledTimes(1); // a NEW refresh token was stored
    expect(result.refreshToken).not.toBe('old-refresh');
  });

  test('400 when no token supplied', async () => {
    await expect(auth.refresh(undefined)).rejects.toMatchObject({ statusCode: 400, code: 'MISSING_REFRESH_TOKEN' });
  });

  test('401 when the token is unknown/consumed/expired', async () => {
    (consumeRefreshToken as jest.Mock).mockResolvedValue(null);
    await expect(auth.refresh('bad')).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_REFRESH_TOKEN' });
  });

  test('401 when the token resolves to a now-inactive user', async () => {
    (consumeRefreshToken as jest.Mock).mockResolvedValue('user1');
    users.findById.mockResolvedValue(makeUser({ active: false }));
    await expect(auth.refresh('old')).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_REFRESH_TOKEN' });
  });
});

describe('logout', () => {
  test('revokes the given refresh token', async () => {
    await auth.logout('some-token');
    expect(revokeRefreshToken).toHaveBeenCalledWith('some-token');
  });

  test('is a no-op (no throw, no revoke call) when no token is given', async () => {
    await expect(auth.logout(undefined)).resolves.toBeUndefined();
    expect(revokeRefreshToken).not.toHaveBeenCalled();
  });
});

describe('forgotPassword (enumeration-safe)', () => {
  test('sets a reset token and emails an existing active user', async () => {
    users.findOne.mockResolvedValue(makeUser());
    await auth.forgotPassword('ada@brandish.ng');
    expect(users.updateById).toHaveBeenCalledWith('user1', expect.objectContaining({
      passwordResetToken: expect.any(String),
      passwordResetExpires: expect.any(Date),
    }));
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  test('resolves silently (no email, no update) for an unknown email', async () => {
    users.findOne.mockResolvedValue(null);
    await expect(auth.forgotPassword('nobody@brandish.ng')).resolves.toBeUndefined();
    expect(users.updateById).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('resolves silently for a malformed email without querying', async () => {
    await auth.forgotPassword('not-an-email');
    expect(users.findOne).not.toHaveBeenCalled();
  });
});

describe('resetPassword', () => {
  test('updates the hash and clears the token on a valid, unexpired token', async () => {
    users.findOne.mockResolvedValue(makeUser({
      passwordResetToken: 'reset-tok',
      passwordResetExpires: new Date(Date.now() + 60_000),
    }));

    await auth.resetPassword('reset-tok', 'newpassword');

    expect(hashPassword).toHaveBeenCalledWith('newpassword');
    expect(users.updateById).toHaveBeenCalledWith('user1', {
      passwordHash: 'new-hash',
      passwordResetToken: null,
      passwordResetExpires: null,
    });
  });

  test('400 WEAK_PASSWORD when the new password is too short', async () => {
    await expect(auth.resetPassword('reset-tok', 'short')).rejects.toMatchObject({ statusCode: 400, code: 'WEAK_PASSWORD' });
  });

  test('400 INVALID_RESET_TOKEN when no matching user', async () => {
    users.findOne.mockResolvedValue(null);
    await expect(auth.resetPassword('bad', 'newpassword')).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_RESET_TOKEN' });
  });

  test('400 INVALID_RESET_TOKEN when the token has expired', async () => {
    users.findOne.mockResolvedValue(makeUser({
      passwordResetToken: 'reset-tok',
      passwordResetExpires: new Date(Date.now() - 60_000),
    }));
    await expect(auth.resetPassword('reset-tok', 'newpassword')).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_RESET_TOKEN' });
  });
});

describe('changePassword', () => {
  test('updates the hash when the current password matches', async () => {
    users.findById.mockResolvedValue(makeUser());
    await auth.changePassword('user1', 'oldpass', 'newpassword');
    expect(comparePassword).toHaveBeenCalledWith('oldpass', 'hashed');
    expect(users.updateById).toHaveBeenCalledWith('user1', { passwordHash: 'new-hash' });
  });

  test('401 when the current password is wrong', async () => {
    users.findById.mockResolvedValue(makeUser());
    (comparePassword as jest.Mock).mockResolvedValue(false);
    await expect(auth.changePassword('user1', 'wrong', 'newpassword')).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CURRENT_PASSWORD' });
  });

  test('404 when the user no longer exists', async () => {
    users.findById.mockResolvedValue(null);
    await expect(auth.changePassword('ghost', 'oldpass', 'newpassword')).rejects.toMatchObject({ statusCode: 404, code: 'USER_NOT_FOUND' });
  });

  test('400 when the new password is too short', async () => {
    await expect(auth.changePassword('user1', 'oldpass', 'short')).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_PASSWORD_CHANGE' });
  });
});

describe('verifyEmail', () => {
  test('flips emailVerified and clears the token', async () => {
    users.findOne.mockResolvedValue(makeUser({ emailVerified: false, emailVerificationToken: 'verify-tok' }));
    await auth.verifyEmail('verify-tok');
    expect(users.updateById).toHaveBeenCalledWith('user1', { emailVerified: true, emailVerificationToken: null });
  });

  test('400 on an unknown token', async () => {
    users.findOne.mockResolvedValue(null);
    await expect(auth.verifyEmail('nope')).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_VERIFICATION_TOKEN' });
  });

  test('400 on a missing token', async () => {
    await expect(auth.verifyEmail(undefined)).rejects.toMatchObject({ statusCode: 400, code: 'MISSING_VERIFICATION_TOKEN' });
  });
});

describe('resendVerification (enumeration-safe)', () => {
  test('issues a new token + email for an unverified user', async () => {
    users.findOne.mockResolvedValue(makeUser({ emailVerified: false }));
    await auth.resendVerification('ada@brandish.ng');
    expect(users.updateById).toHaveBeenCalledWith('user1', { emailVerificationToken: expect.any(String) });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  test('does nothing for an already-verified user', async () => {
    users.findOne.mockResolvedValue(makeUser({ emailVerified: true }));
    await auth.resendVerification('ada@brandish.ng');
    expect(users.updateById).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
