import { comparePassword, hashPassword } from '../../lib/password';

describe('password hashing', () => {
  test('hash does not equal the plaintext', async () => {
    const hash = await hashPassword('correct horse');
    expect(hash).not.toBe('correct horse');
    expect(hash.length).toBeGreaterThan(20);
  });

  test('comparePassword returns true for the right password', async () => {
    const hash = await hashPassword('correct horse');
    await expect(comparePassword('correct horse', hash)).resolves.toBe(true);
  });

  test('comparePassword returns false for the wrong password', async () => {
    const hash = await hashPassword('correct horse');
    await expect(comparePassword('wrong', hash)).resolves.toBe(false);
  });
});
