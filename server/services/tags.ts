import { AppError } from '../lib/errors';
import { slugify } from '../lib/slug';
import { getTagModel, type TagDoc } from '../lib/models/Tag';
import { isNonEmptyString } from '../lib/validation';

const LIST_SORT = 'name';
const LIST_LIMIT = 100;

export async function listTags(): Promise<TagDoc[]> {
  const model = await getTagModel();
  return model.find({}, { sort: LIST_SORT, limit: LIST_LIMIT });
}

export async function createTag(name: unknown): Promise<TagDoc> {
  if (!isNonEmptyString(name)) {
    throw new AppError(400, 'INVALID_TAG_INPUT', 'name is required');
  }
  const slug = slugify(name);
  if (!slug) {
    throw new AppError(400, 'INVALID_TAG_INPUT', 'name must contain at least one letter or number');
  }

  const model = await getTagModel();
  // A duplicate tag is a real conflict, not a collision to auto-suffix around (unlike post
  // slugs). Pre-check for a clean 409; the unique index is the race-safe backstop below.
  if (await model.exists({ slug })) {
    throw new AppError(409, 'TAG_EXISTS', 'A tag with that name already exists');
  }

  try {
    return await model.create({ name, slug });
  } catch (err: any) {
    if (err?.code === 11000) {
      throw new AppError(409, 'TAG_EXISTS', 'A tag with that name already exists');
    }
    throw err;
  }
}

export async function deleteTag(id: string): Promise<void> {
  const model = await getTagModel();
  const deleted = await model.delete(id);
  if (!deleted) throw new AppError(404, 'TAG_NOT_FOUND', 'Tag not found');
  // No cascade to `posts.tags` — a post referencing a deleted tag's slug simply won't
  // resolve on a tag lookup; the frontend drops it from display (see docs/api-routes.md).
}
