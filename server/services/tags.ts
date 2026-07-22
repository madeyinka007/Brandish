import { AppError } from '../lib/errors';
import { slugify } from '../lib/slug';
import { getTagModel, type TagDoc } from '../lib/models/Tag';
import { getPostModel } from '../lib/models/Post';
import { isNonEmptyString } from '../lib/validation';

const LIST_SORT = 'name';
const LIST_LIMIT = 100;

export async function listTags(): Promise<TagDoc[]> {
  const model = await getTagModel();
  return model.find({}, { sort: LIST_SORT, limit: LIST_LIMIT });
}

export interface TagWithUsage extends TagDoc {
  postCount: number;
}

/**
 * Tags augmented with `postCount` — how many posts reference each tag's slug. Computed by
 * aggregating `posts.tags` (denormalised slug array): unwind the array and group by slug. Used
 * by the admin taxonomy view for the Posts column + Used/Unused filters. Counts posts of ANY
 * status (drafts included), since it reflects tag usage across all content.
 */
export async function listTagsWithUsage(): Promise<TagWithUsage[]> {
  const [model, postModel] = await Promise.all([getTagModel(), getPostModel()]);
  const tags = await model.find({}, { sort: LIST_SORT, limit: LIST_LIMIT });

  const usage = await postModel.aggregate<{ _id: string; count: number }>([
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
  ]);
  const counts = new Map(usage.map((u) => [u._id, u.count]));

  return tags.map((t) => {
    const obj = typeof (t as any).toObject === 'function' ? (t as any).toObject() : { ...(t as object) };
    return { ...obj, postCount: counts.get(t.slug) ?? 0 } as TagWithUsage;
  });
}

export interface CreateTagInput {
  name: unknown;
  description?: unknown;
  color?: unknown;
}

export async function createTag(input: CreateTagInput): Promise<TagDoc> {
  const { name, description, color } = input;
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
    return await model.create({
      name,
      slug,
      description: isNonEmptyString(description) ? (description as string) : '',
      color: isNonEmptyString(color) ? (color as string) : '',
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      throw new AppError(409, 'TAG_EXISTS', 'A tag with that name already exists');
    }
    throw err;
  }
}

/**
 * Edits `name` / `description` / `color`. Like categories, the `slug` is NEVER updated — it's
 * the immutable identifier `posts.tags` denormalizes (see docs/data-model.md), so a mutable
 * slug would orphan every referencing post. Renaming a tag changes display text only.
 */
export async function updateTag(id: string, data: Record<string, unknown>): Promise<TagDoc> {
  const update: Record<string, unknown> = {};

  if (data.name !== undefined) {
    if (!isNonEmptyString(data.name)) throw new AppError(400, 'INVALID_TAG_INPUT', 'name must be a non-empty string');
    update.name = data.name;
  }
  if (data.description !== undefined) update.description = isNonEmptyString(data.description) ? data.description : '';
  if (data.color !== undefined) update.color = isNonEmptyString(data.color) ? data.color : '';
  // data.slug is intentionally ignored — never editable.

  const model = await getTagModel();
  const tag = await model.updateById(id, update);
  if (!tag) throw new AppError(404, 'TAG_NOT_FOUND', 'Tag not found');
  return tag;
}

export async function deleteTag(id: string): Promise<void> {
  const model = await getTagModel();
  const deleted = await model.delete(id);
  if (!deleted) throw new AppError(404, 'TAG_NOT_FOUND', 'Tag not found');
  // No cascade to `posts.tags` — a post referencing a deleted tag's slug simply won't
  // resolve on a tag lookup; the frontend drops it from display (see docs/api-routes.md).
}
