import { getPostModel } from './models/Post';

/**
 * Pure, collection-agnostic slug generator. Uniqueness is a per-collection concern —
 * the Categories/Tags services check `*Model.exists` themselves, so `slugify` stays
 * reusable across every collection and holds no collection-specific logic.
 *
 * The Post-bound `uniqueSlug()` below is the one exception the header comment anticipated:
 * posts expect duplicate titles and auto-suffix rather than 409, so their uniqueness helper
 * lives here alongside `slugify` (see docs/development.md). It's kept as a separate function —
 * collection-specific uniqueness is never folded into `slugify` itself.
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

/**
 * Post slug generator: slugify the title, then append a numeric suffix (`-2`, `-3`, …) until
 * it's unique among posts. Unlike categories/tags (which 409 on a duplicate name), duplicate
 * post titles are expected, so posts auto-suffix instead.
 *
 * Pass `excludeId` on update so a post doesn't collide with its own current slug (only *other*
 * posts count as a conflict). Uniqueness is checked through the Post model — never a raw `Db`
 * handle — per the ODM split (docs/data-model.md). Returns '' if the title has no slug-able
 * characters; the caller rejects that with a 400 (same as categories/tags).
 */
export async function uniqueSlug(title: string, excludeId?: string): Promise<string> {
  const base = slugify(title);
  if (!base) return '';

  const model = await getPostModel();
  const taken = (candidate: string) =>
    model.exists(excludeId ? { slug: candidate, _id: { $ne: excludeId } } : { slug: candidate });

  let slug = base;
  let suffix = 2;
  while (await taken(slug)) {
    slug = `${base}-${suffix++}`;
  }
  return slug;
}
