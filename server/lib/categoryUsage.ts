import { getPostModel } from './models/Post';

/**
 * Whether any post references the given category slug. The Categories service's delete guard
 * depends on this to avoid orphaning `posts.category` values (denormalized slug strings, not
 * refs — see docs/data-model.md).
 *
 * Wired to the Post model as of the Posts module (this replaced the earlier 501 stub that
 * blocked category deletes until a working guard existed). Kept in its own seam so the
 * Categories service doesn't import the Post model directly.
 */
export async function isCategoryInUse(slug: string): Promise<boolean> {
  const model = await getPostModel();
  return model.exists({ category: slug });
}
