import { AppError } from './errors';

/**
 * Whether any post references the given category slug. The Categories service's delete
 * guard depends on this to avoid orphaning `posts.category` values (which are denormalized
 * slug strings, not refs — see docs/data-model.md).
 *
 * TODO(posts-module): implement as `(await getPostModel()).exists({ category: slug })` once
 * the Posts module (`server/lib/models/Post.ts`) exists. Until then this THROWS rather than
 * returning a value — a category delete cannot be allowed without a working guard, so we
 * fail loudly (501) instead of silently risking orphaned posts. See the Posts module prompt.
 */
export async function isCategoryInUse(_slug: string): Promise<boolean> {
  throw new AppError(
    501,
    'NOT_IMPLEMENTED',
    'Category delete-in-use guard is not wired up yet — it needs the Posts module (PostModel.exists)',
  );
}
