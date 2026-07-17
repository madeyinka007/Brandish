/**
 * Pure, collection-agnostic slug generator. Uniqueness is a per-collection concern and
 * lives in the calling service (e.g. the Categories service checks `CategoryModel.exists`),
 * NOT here — so this stays reusable across posts, categories, tags, etc.
 *
 * The Posts module adds a Post-bound `uniqueSlug()` alongside this (see docs/development.md);
 * don't fold collection-specific uniqueness into `slugify`.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // drop non-alphanumeric except spaces and hyphens
    .replace(/\s+/g, '-')          // spaces → hyphens
    .replace(/-+/g, '-')           // collapse repeats
    .replace(/^-|-$/g, '');        // trim leading/trailing hyphens
}
