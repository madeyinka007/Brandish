// lib/mongoose connects at import time — mock it so importing the seed script (→ User →
// mongo → mongoose) makes no real connection.
jest.mock('../../lib/mongoose', () => ({ dbConnect: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/password');
jest.mock('../../lib/models/User', () => {
  const actual = jest.requireActual('../../lib/models/User');
  return { ...actual, getUserModel: jest.fn() };
});

import { hashPassword } from '../../lib/password';
import { getUserModel } from '../../lib/models/User';
import { seedSuperAdmin, SEED_ADMIN } from '../../scripts/seedSuperAdmin';

let model: { findOne: jest.Mock; create: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  model = { findOne: jest.fn(), create: jest.fn() };
  (getUserModel as jest.Mock).mockResolvedValue(model);
  (hashPassword as jest.Mock).mockResolvedValue('HASHED');
});

describe('seedSuperAdmin', () => {
  test('uses the requested default credentials', () => {
    expect(SEED_ADMIN.email).toBe('admin@brandish.com.ng');
    expect(SEED_ADMIN.password).toBe('Admin@2026');
  });

  test('creates a pre-verified super-admin with a hashed password when none exists', async () => {
    model.findOne.mockResolvedValue(null);
    model.create.mockResolvedValue({ _id: 'u1' });

    await expect(seedSuperAdmin()).resolves.toBe('created');

    expect(hashPassword).toHaveBeenCalledWith('Admin@2026');
    const created = model.create.mock.calls[0][0];
    expect(created).toMatchObject({
      email: 'admin@brandish.com.ng',
      role: 'super-admin',
      emailVerified: true,
      passwordHash: 'HASHED',
      active: true,
    });
    expect(created).not.toHaveProperty('password'); // never the plaintext
  });

  test('is idempotent — does nothing when the admin already exists', async () => {
    model.findOne.mockResolvedValue({ _id: 'existing' });

    await expect(seedSuperAdmin()).resolves.toBe('exists');
    expect(model.create).not.toHaveBeenCalled();
  });

  test('treats a unique-index race (E11000) as already-seeded', async () => {
    model.findOne.mockResolvedValue(null);
    model.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));

    await expect(seedSuperAdmin()).resolves.toBe('exists');
  });

  test('re-throws any non-duplicate error', async () => {
    model.findOne.mockResolvedValue(null);
    model.create.mockRejectedValue(new Error('network down'));

    await expect(seedSuperAdmin()).rejects.toThrow('network down');
  });
});
