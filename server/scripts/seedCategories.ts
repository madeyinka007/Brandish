import 'dotenv/config';
import { getCategoryModel } from '../lib/models/Category';

/**
 * Seeds the 10 business verticals Brandish launched with. These are now just a starting
 * set (categories are fully CRUD-able — see docs/data-model.md), not a hardcoded ceiling.
 * Idempotent: each is inserted only if its slug doesn't already exist, so re-running (and
 * running after editors have added their own categories) is safe.
 *
 * Run:  node --env-file=.env node_modules/.bin/ts-node scripts/seedCategories.ts
 *   or: npm run seed:categories
 */
const SEED_CATEGORIES: Array<{ name: string; slug: string }> = [
  { name: 'Advertising', slug: 'advertising' },
  { name: 'Money', slug: 'money' },
  { name: 'Public Relations', slug: 'public-relations' },
  { name: 'Telecoms', slug: 'telecoms' },
  { name: 'FMCG', slug: 'fmcg' },
  { name: 'Leadership', slug: 'leadership' },
  { name: 'Government', slug: 'government' },
  { name: 'Energy', slug: 'energy' },
  { name: 'Technology', slug: 'technology' },
  { name: 'Entertainment', slug: 'entertainment' },
];

export async function seedCategories(): Promise<{ created: number; skipped: number }> {
  const model = await getCategoryModel();
  let created = 0;
  let skipped = 0;

  for (const [index, { name, slug }] of SEED_CATEGORIES.entries()) {
    if (await model.exists({ slug })) {
      skipped++;
      continue;
    }
    try {
      await model.create({
        name,
        slug,
        description: '',
        color: '',
        order: index, // preserve the listed order
        status: 'active',
        seo: { title: '', description: '', keywords: '', ogImage: '' },
      });
      created++;
    } catch (err: any) {
      // Unique-index race — another run inserted it first.
      if (err?.code === 11000) {
        skipped++;
        continue;
      }
      throw err;
    }
  }

  console.log(`Seed categories: ${created} created, ${skipped} skipped (already present).`);
  return { created, skipped };
}

if (require.main === module) {
  seedCategories()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
