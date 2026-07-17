import { slugify } from '../../lib/slug';

describe('slugify', () => {
  test.each([
    ['Public Relations', 'public-relations'],
    ['  Trimmed  ', 'trimmed'],
    ['FMCG', 'fmcg'],
    ['Tech & Media!', 'tech-media'],           // punctuation dropped, spaces → hyphens
    ['multiple   spaces', 'multiple-spaces'],  // collapsed
    ['already-hyphenated', 'already-hyphenated'],
    ['--edges--', 'edges'],                    // leading/trailing hyphens trimmed
    ['café münchen', 'caf-mnchen'],            // non-ascii letters dropped
    ['!!!', ''],                               // punctuation-only → empty (caller rejects)
  ])('slugify(%p) === %p', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});
