// lib/mongoose runs mongoose.connect() at import time — mock it so requireActual(User)
// below (which pulls in the mongo → mongoose chain) makes no real connection.
jest.mock('../../lib/mongoose', () => ({ dbConnect: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/password');
jest.mock('../../lib/ses');
// Keep the REAL sanitizeUser + ROLES (so we genuinely assert passwordHash is stripped),
// but replace getUserModel with a mock we control.
jest.mock('../../lib/models/User', () => {
  const actual = jest.requireActual('../../lib/models/User');
  return { ...actual, getUserModel: jest.fn() };
});

import { hashPassword } from '../../lib/password';
import { sendEmail } from '../../lib/ses';
import { getUserModel } from '../../lib/models/User';
import * as users from '../../services/users';

function makeUserDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'user1',
    name: 'Ada',
    email: 'ada@brandish.ng',
    passwordHash: 'HASHED-SECRET',
    role: 'editor',
    avatar: '',
    active: true,
    emailVerified: false,
    emailVerificationToken: 'verify-secret',
    passwordResetToken: 'reset-secret',
    passwordResetExpires: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const SENSITIVE = ['passwordHash', 'emailVerificationToken', 'passwordResetToken', 'passwordResetExpires'];

let model: {
  find: jest.Mock;
  findById: jest.Mock;
  create: jest.Mock;
  updateById: jest.Mock;
  delete: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.FRONTEND_URL = 'https://brandish.ng';
  model = { find: jest.fn(), findById: jest.fn(), create: jest.fn(), updateById: jest.fn(), delete: jest.fn() };
  (getUserModel as jest.Mock).mockResolvedValue(model);
  (hashPassword as jest.Mock).mockResolvedValue('HASHED-SECRET');
  (sendEmail as jest.Mock).mockResolvedValue(undefined);
});

describe('listUsers', () => {
  test('strips every sensitive field from each returned user', async () => {
    model.find.mockResolvedValue([makeUserDoc(), makeUserDoc({ _id: 'user2' })]);

    const result = await users.listUsers();

    expect(result).toHaveLength(2);
    for (const u of result) {
      for (const field of SENSITIVE) expect(u).not.toHaveProperty(field);
    }
  });
});

describe('listAuthors', () => {
  test('queries active content-role users and returns only minimal fields', async () => {
    model.find.mockResolvedValue([makeUserDoc({ _id: 'a1', name: 'Ada', avatar: 'x', role: 'author' })]);

    const result = await users.listAuthors();

    // filter: content roles + active
    const [filter, opts] = model.find.mock.calls[0];
    expect(filter).toEqual({ role: { $in: ['super-admin', 'editor', 'author'] }, active: true });
    expect(opts).toMatchObject({ sort: 'name' });
    // minimal shape only — no email/tokens
    expect(result).toEqual([{ _id: 'a1', name: 'Ada', avatar: 'x', role: 'author' }]);
    expect(result[0]).not.toHaveProperty('email');
    for (const field of SENSITIVE) expect(result[0]).not.toHaveProperty(field);
  });
});

describe('createUser', () => {
  test('hashes the password (never stores plaintext) and returns a sanitized user', async () => {
    model.create.mockResolvedValue(makeUserDoc());

    const result = await users.createUser({
      name: 'Ada',
      email: 'ada@brandish.ng',
      password: 'plaintext-password',
      role: 'editor',
    });

    expect(hashPassword).toHaveBeenCalledWith('plaintext-password');
    const createdWith = model.create.mock.calls[0][0];
    expect(createdWith.passwordHash).toBe('HASHED-SECRET');
    expect(createdWith).not.toHaveProperty('password'); // plaintext never passed to the model
    for (const field of SENSITIVE) expect(result).not.toHaveProperty(field);
  });

  test('issues a verification token + email on create', async () => {
    model.create.mockResolvedValue(makeUserDoc());

    await users.createUser({ name: 'Ada', email: 'ada@brandish.ng', password: 'plaintext-password', role: 'editor' });

    const createdWith = model.create.mock.calls[0][0];
    expect(createdWith.emailVerified).toBe(false);
    expect(typeof createdWith.emailVerificationToken).toBe('string');
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect((sendEmail as jest.Mock).mock.calls[0][0]).toBe('ada@brandish.ng');
  });

  test('accepts the new "reader" role', async () => {
    model.create.mockResolvedValue(makeUserDoc({ role: 'reader' }));
    await expect(
      users.createUser({ name: 'R', email: 'r@brandish.ng', password: 'plaintext-password', role: 'reader' }),
    ).resolves.toMatchObject({ role: 'reader' });
  });

  test('400 on invalid input (bad email / short password / bad role)', async () => {
    await expect(users.createUser({ name: 'A', email: 'nope', password: 'plaintext-password', role: 'editor' }))
      .rejects.toMatchObject({ statusCode: 400, code: 'INVALID_USER_INPUT' });
    await expect(users.createUser({ name: 'A', email: 'a@b.com', password: 'short', role: 'editor' }))
      .rejects.toMatchObject({ statusCode: 400, code: 'INVALID_USER_INPUT' });
    await expect(users.createUser({ name: 'A', email: 'a@b.com', password: 'plaintext-password', role: 'wizard' }))
      .rejects.toMatchObject({ statusCode: 400, code: 'INVALID_USER_INPUT' });
    expect(model.create).not.toHaveBeenCalled();
  });

  test('409 EMAIL_EXISTS on a duplicate-key error, and no email is sent', async () => {
    model.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));

    await expect(users.createUser({ name: 'A', email: 'a@b.com', password: 'plaintext-password', role: 'editor' }))
      .rejects.toMatchObject({ statusCode: 409, code: 'EMAIL_EXISTS' });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe('updateUser', () => {
  test('applies only the whitelisted name/email/avatar fields', async () => {
    model.updateById.mockResolvedValue(makeUserDoc({ name: 'New Name' }));

    await users.updateUser('user1', { name: 'New Name', avatar: undefined, email: undefined });

    expect(model.updateById).toHaveBeenCalledWith('user1', { name: 'New Name' });
  });

  test('400 on an invalid email', async () => {
    await expect(users.updateUser('user1', { email: 'bad' })).rejects.toMatchObject({ statusCode: 400 });
  });

  test('404 when the user does not exist', async () => {
    model.updateById.mockResolvedValue(null);
    await expect(users.updateUser('ghost', { name: 'X' })).rejects.toMatchObject({ statusCode: 404, code: 'USER_NOT_FOUND' });
  });

  test('409 on a duplicate email', async () => {
    model.updateById.mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
    await expect(users.updateUser('user1', { email: 'taken@b.com' })).rejects.toMatchObject({ statusCode: 409, code: 'EMAIL_EXISTS' });
  });
});

describe('assignRole', () => {
  test('updates a valid role and returns a sanitized user', async () => {
    model.updateById.mockResolvedValue(makeUserDoc({ role: 'super-admin' }));

    const result = await users.assignRole('user1', 'super-admin');

    expect(model.updateById).toHaveBeenCalledWith('user1', { role: 'super-admin' });
    for (const field of SENSITIVE) expect(result).not.toHaveProperty(field);
  });

  test('400 INVALID_ROLE for an unknown role', async () => {
    await expect(users.assignRole('user1', 'overlord')).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_ROLE' });
    expect(model.updateById).not.toHaveBeenCalled();
  });

  test('404 when the user does not exist', async () => {
    model.updateById.mockResolvedValue(null);
    await expect(users.assignRole('ghost', 'editor')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('setStatus', () => {
  test('updates active when given a boolean', async () => {
    model.updateById.mockResolvedValue(makeUserDoc({ active: false }));
    await users.setStatus('user1', false);
    expect(model.updateById).toHaveBeenCalledWith('user1', { active: false });
  });

  test('400 when active is not a boolean', async () => {
    await expect(users.setStatus('user1', 'yes')).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_STATUS' });
    expect(model.updateById).not.toHaveBeenCalled();
  });
});

describe('deleteUser', () => {
  test('hard-deletes and resolves', async () => {
    model.delete.mockResolvedValue(makeUserDoc());
    await expect(users.deleteUser('user1')).resolves.toBeUndefined();
    expect(model.delete).toHaveBeenCalledWith('user1');
  });

  test('404 when nothing was deleted', async () => {
    model.delete.mockResolvedValue(null);
    await expect(users.deleteUser('ghost')).rejects.toMatchObject({ statusCode: 404, code: 'USER_NOT_FOUND' });
  });
});
