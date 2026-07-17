import { AppError } from '../lib/errors';
import { slugify } from '../lib/slug';
import { isCategoryInUse } from '../lib/categoryUsage';
import {
  getCategoryModel,
  CATEGORY_STATUSES,
  type CategoryDoc,
  type CategorySeo,
  type CategoryStatus,
} from '../lib/models/Category';
import { isNonEmptyString } from '../lib/validation';

const LIST_SORT = 'order name'; // ascending order, then name
const LIST_LIMIT = 100; // categories are few; a single page is enough

function isValidStatus(value: unknown): value is CategoryStatus {
  return typeof value === 'string' && (CATEGORY_STATUSES as readonly string[]).includes(value);
}

function normalizeSeo(seo: unknown): CategorySeo {
  if (typeof seo !== 'object' || seo === null) {
    throw new AppError(400, 'INVALID_CATEGORY_INPUT', 'seo must be an object');
  }
  const s = seo as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  return { title: str(s.title), description: str(s.description), keywords: str(s.keywords), ogImage: str(s.ogImage) };
}

export interface CreateCategoryInput {
  name: unknown;
  description?: unknown;
  color?: unknown;
  order?: unknown;
  status?: unknown;
  seo?: unknown;
}

export async function listPublic(): Promise<CategoryDoc[]> {
  const model = await getCategoryModel();
  return model.find({ status: 'active' }, { sort: LIST_SORT, limit: LIST_LIMIT });
}

export async function listAll(): Promise<CategoryDoc[]> {
  const model = await getCategoryModel();
  return model.find({}, { sort: LIST_SORT, limit: LIST_LIMIT });
}

export async function createCategory(input: CreateCategoryInput): Promise<CategoryDoc> {
  if (!isNonEmptyString(input.name)) {
    throw new AppError(400, 'INVALID_CATEGORY_INPUT', 'name is required');
  }
  if (input.status !== undefined && !isValidStatus(input.status)) {
    throw new AppError(400, 'INVALID_CATEGORY_INPUT', `status must be one of: ${CATEGORY_STATUSES.join(', ')}`);
  }
  if (input.order !== undefined && typeof input.order !== 'number') {
    throw new AppError(400, 'INVALID_CATEGORY_INPUT', 'order must be a number');
  }

  const slug = slugify(input.name);
  // A name of only punctuation slugifies to '' — reject rather than store an empty slug.
  if (!slug) {
    throw new AppError(400, 'INVALID_CATEGORY_INPUT', 'name must contain at least one letter or number');
  }

  const model = await getCategoryModel();
  // Reject duplicate names (409) rather than auto-suffix the slug: a controlled taxonomy
  // shouldn't grow "technology" + "technology-2". (Auto-suffixing is a posts behavior, where
  // duplicate titles are expected.) The unique index is the race-safe backstop below.
  if (await model.exists({ slug })) {
    throw new AppError(409, 'NAME_EXISTS', 'A category with that name already exists');
  }

  try {
    return await model.create({
      name: input.name,
      slug,
      description: isNonEmptyString(input.description) ? (input.description as string) : '',
      color: isNonEmptyString(input.color) ? (input.color as string) : '',
      order: typeof input.order === 'number' ? input.order : 0,
      status: isValidStatus(input.status) ? input.status : 'active',
      seo: input.seo !== undefined ? normalizeSeo(input.seo) : { title: '', description: '', keywords: '', ogImage: '' },
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      throw new AppError(409, 'NAME_EXISTS', 'A category with that name already exists');
    }
    throw err;
  }
}

/**
 * Edits display/metadata fields only. `slug` is NEVER updated even if present in the
 * payload — it's the immutable identifier `posts.category` denormalizes (see
 * docs/data-model.md). Renaming `name` intentionally leaves `slug` untouched.
 */
export async function updateCategory(
  id: string,
  data: Record<string, unknown>,
): Promise<CategoryDoc> {
  const update: Record<string, unknown> = {};

  if (data.name !== undefined) {
    if (!isNonEmptyString(data.name)) throw new AppError(400, 'INVALID_CATEGORY_INPUT', 'name must be a non-empty string');
    update.name = data.name;
  }
  if (data.description !== undefined) update.description = isNonEmptyString(data.description) ? data.description : '';
  if (data.color !== undefined) update.color = isNonEmptyString(data.color) ? data.color : '';
  if (data.order !== undefined) {
    if (typeof data.order !== 'number') throw new AppError(400, 'INVALID_CATEGORY_INPUT', 'order must be a number');
    update.order = data.order;
  }
  if (data.status !== undefined) {
    if (!isValidStatus(data.status)) throw new AppError(400, 'INVALID_CATEGORY_INPUT', `status must be one of: ${CATEGORY_STATUSES.join(', ')}`);
    update.status = data.status;
  }
  if (data.seo !== undefined) update.seo = normalizeSeo(data.seo);
  // data.slug is intentionally ignored — never editable.

  const model = await getCategoryModel();
  const category = await model.updateById(id, update);
  if (!category) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
  return category;
}

export async function deleteCategory(id: string): Promise<void> {
  const model = await getCategoryModel();
  const category = await model.findById(id);
  if (!category) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found');

  // Guard: never delete a category any post still references (would orphan posts.category).
  if (await isCategoryInUse(category.slug)) {
    throw new AppError(409, 'CATEGORY_IN_USE', 'Cannot delete a category that still has posts');
  }
  await model.delete(id);
}

export interface ReorderItem {
  id: string;
  order: number;
}

export async function reorder(items: unknown): Promise<void> {
  if (!Array.isArray(items) || items.some((i) => !i || typeof i.id !== 'string' || typeof i.order !== 'number')) {
    throw new AppError(400, 'INVALID_CATEGORY_INPUT', 'reorder expects an array of { id: string, order: number }');
  }
  const model = await getCategoryModel();
  await Promise.all((items as ReorderItem[]).map((i) => model.updateById(i.id, { order: i.order })));
}
