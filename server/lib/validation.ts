// Pure, dependency-free validators. Hand-rolled rather than pulling in a validation library
// (zod/joi/etc.) — adding a dependency is a documented no-go without consulting the docs
// first (CLAUDE.md), and the payloads here are simple enough not to warrant one.

export const MIN_PASSWORD_LENGTH = 8;

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isStrongPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= MIN_PASSWORD_LENGTH;
}
