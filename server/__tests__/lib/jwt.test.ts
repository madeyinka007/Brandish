import jwt from 'jsonwebtoken';
import { signAccessToken, verifyAccessToken } from '../../lib/jwt';

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret';
});

describe('signAccessToken / verifyAccessToken', () => {
  test('round-trips the payload fields', () => {
    const token = signAccessToken({ userId: 'u1', role: 'editor', email: 'a@b.com' });
    expect(verifyAccessToken(token)).toEqual({ userId: 'u1', role: 'editor', email: 'a@b.com' });
  });

  test('throws on a token signed with a different secret', () => {
    const foreign = jwt.sign({ userId: 'u1', role: 'editor', email: 'a@b.com' }, 'other-secret');
    expect(() => verifyAccessToken(foreign)).toThrow();
  });

  test('throws on a garbage token', () => {
    expect(() => verifyAccessToken('not-a-jwt')).toThrow();
  });

  test('throws on an expired token', () => {
    const expired = jwt.sign({ userId: 'u1', role: 'editor', email: 'a@b.com' }, 'test-secret', { expiresIn: -10 });
    expect(() => verifyAccessToken(expired)).toThrow();
  });
});
