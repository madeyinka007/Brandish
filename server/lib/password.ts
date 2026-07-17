import bcrypt from 'bcryptjs';

// Cost factor 10 — the value fixed by docs/auth.md's password-hashing convention.
const BCRYPT_COST = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
