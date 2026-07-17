import { isEmail, isNonEmptyString, isStrongPassword } from '../../lib/validation';

describe('isNonEmptyString', () => {
  test.each([
    ['hello', true],
    ['   ', false],
    ['', false],
    [123, false],
    [null, false],
    [undefined, false],
  ])('isNonEmptyString(%p) === %p', (input, expected) => {
    expect(isNonEmptyString(input)).toBe(expected);
  });
});

describe('isEmail', () => {
  test.each([
    ['a@b.com', true],
    ['first.last@sub.domain.ng', true],
    ['no-at-sign', false],
    ['a@b', false],
    ['a@@b.com', false],
    ['', false],
    [42, false],
  ])('isEmail(%p) === %p', (input, expected) => {
    expect(isEmail(input)).toBe(expected);
  });
});

describe('isStrongPassword', () => {
  test.each([
    ['12345678', true],
    ['1234567', false],
    ['', false],
    [12345678, false],
  ])('isStrongPassword(%p) === %p', (input, expected) => {
    expect(isStrongPassword(input)).toBe(expected);
  });
});
