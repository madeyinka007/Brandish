import { AppError } from '../lib/errors';
import { uniqueSlug } from '../lib/slug';
import { logAudit } from '../lib/auditLog';
import { revalidatePost, purgePost } from '../lib/revalidate';
import { getUserModel } from '../lib/models/User';
import {
  getPostModel,
  POST_FORMATS,
  POST_STATUSES,
  type PostDoc,
  type PostFormat,
  type PostStatus,
} from '../lib/models/Post';
import { isNonEmptyString } from '../lib/validation';

const PUBLIC_SORT = '-publishedAt'; // newest published first
const ADMIN_SORT = '-createdAt'; // newest created first

function isValidFormat(value: unknown): value is PostFormat {
  return typeof value === 'string' && (POST_FORMATS as readonly string[]).includes(value);
}

function isValidStatus(value: unknown): value is PostStatus {
  return typeof value === 'string' && (POST_STATUSES as readonly string[]).includes(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function parseDate(value: unknown): Date {
  const d = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(d.getTime())) {
    throw new AppError(400, 'INVALID_POST_INPUT', 'publishedAt must be a valid date');
  }
  return d;
}

/**
 * The route-level format-conditional check (docs/api-routes.md): a `gallery` needs a non-empty
 * `media` array, a `video` needs a `videoId`. Returns 422 — the business-rule shape — *before*
 * the write reaches Mongoose's schema validator (which is the backstop, not the only check).
 */
function validateFormatFields(format: PostFormat, media: string[], videoId: string | null): void {
  if (format === 'gallery' && (!Array.isArray(media) || media.length === 0)) {
    throw new AppError(422, 'GALLERY_MEDIA_REQUIRED', 'A gallery post requires a non-empty media array');
  }
  if (format === 'video' && !isNonEmptyString(videoId)) {
    throw new AppError(422, 'VIDEO_ID_REQUIRED', 'A video post requires a videoId');
  }
}

// ---- Public reads ----

export interface ListParams {
  category?: unknown;
  status?: unknown;
  page?: number;
  limit?: number;
}

/** Public listing — published posts only, newest first, optionally filtered by category. */
export async function listPublicPosts(params: ListParams) {
  const model = await getPostModel();
  const filter: Record<string, unknown> = { status: 'published' };
  if (isNonEmptyString(params.category)) filter.category = params.category;
  return model.paginate(filter, { page: params.page, limit: params.limit, sort: PUBLIC_SORT });
}

/** Admin listing — every status and author, newest created first, optional category/status filter. */
export async function listAllPosts(params: ListParams) {
  const model = await getPostModel();
  const filter: Record<string, unknown> = {};
  if (isNonEmptyString(params.category)) filter.category = params.category;
  if (params.status !== undefined) {
    if (!isValidStatus(params.status)) {
      throw new AppError(400, 'INVALID_POST_INPUT', `status must be one of: ${POST_STATUSES.join(', ')}`);
    }
    filter.status = params.status;
  }
  return model.paginate(filter, { page: params.page, limit: params.limit, sort: ADMIN_SORT });
}

/** Single published post by slug — the public post page. 404 if missing or not published. */
export async function getPublishedBySlug(slug: string): Promise<PostDoc> {
  const model = await getPostModel();
  const post = await model.findOne({ slug, status: 'published' });
  if (!post) throw new AppError(404, 'POST_NOT_FOUND', 'Post not found');
  return post;
}

// ---- Mutations ----

/** Resolves the acting user into the denormalised author snapshot embedded on the post. */
async function resolveAuthor(actorId: string): Promise<PostDoc['author']> {
  const users = await getUserModel();
  const user = await users.findById(actorId);
  if (!user) throw new AppError(404, 'AUTHOR_NOT_FOUND', 'Authenticated user no longer exists');
  return { _id: user._id, name: user.name, avatar: user.avatar };
}

/**
 * Creates a post. The slug is generated server-side from the title (never trusted from the
 * client), the author is the acting user (embedded), and the format-conditional fields are
 * validated (422) before the write. A post created already-`published` is revalidated and
 * audited here, same as the publish transition in `updatePost`.
 */
export async function createPost(data: Record<string, unknown>, actorId: string): Promise<PostDoc> {
  if (!isNonEmptyString(data.title)) throw new AppError(400, 'INVALID_POST_INPUT', 'title is required');
  if (!isNonEmptyString(data.category)) throw new AppError(400, 'INVALID_POST_INPUT', 'category is required');

  const format: PostFormat = data.format === undefined ? 'article' : isValidFormat(data.format)
    ? data.format
    : (() => { throw new AppError(400, 'INVALID_POST_INPUT', `format must be one of: ${POST_FORMATS.join(', ')}`); })();

  const status: PostStatus = data.status === undefined ? 'draft' : isValidStatus(data.status)
    ? data.status
    : (() => { throw new AppError(400, 'INVALID_POST_INPUT', `status must be one of: ${POST_STATUSES.join(', ')}`); })();

  if (data.tags !== undefined && !isStringArray(data.tags)) {
    throw new AppError(400, 'INVALID_POST_INPUT', 'tags must be an array of slug strings');
  }
  if (data.media !== undefined && !isStringArray(data.media)) {
    throw new AppError(400, 'INVALID_POST_INPUT', 'media must be an array of URL strings');
  }

  const media = isStringArray(data.media) ? data.media : [];
  const videoId = isNonEmptyString(data.videoId) ? data.videoId : null;
  validateFormatFields(format, media, videoId);

  const slug = await uniqueSlug(data.title);
  if (!slug) throw new AppError(400, 'INVALID_POST_INPUT', 'title must contain at least one letter or number');

  const author = await resolveAuthor(actorId);

  const publishedAt =
    data.publishedAt !== undefined ? parseDate(data.publishedAt) : status === 'published' ? new Date() : null;

  const model = await getPostModel();
  const post = await model.create({
    title: data.title,
    slug,
    body: data.body ?? {},
    excerpt: isNonEmptyString(data.excerpt) ? (data.excerpt as string) : '',
    format,
    coverImage: isNonEmptyString(data.coverImage) ? (data.coverImage as string) : '',
    category: data.category,
    tags: isStringArray(data.tags) ? data.tags : [],
    author,
    media,
    videoId,
    keywords: isNonEmptyString(data.keywords) ? (data.keywords as string) : '',
    ogImage: isNonEmptyString(data.ogImage) ? (data.ogImage as string) : '',
    status,
    viewCount: 0,
    publishedAt,
  } as Partial<PostDoc>);

  if (status === 'published') {
    await revalidatePost(post);
    await logAudit('post.publish', 'post', String(post._id), actorId, { slug: post.slug, title: post.title });
  }
  return post;
}

/**
 * Updates a post. Whitelists editable fields, re-validates slug uniqueness when the slug is
 * being edited (excluding the post itself), and re-checks the format-conditional fields (422)
 * against the *effective* post shape. On a transition to `published` it sets `publishedAt`
 * (if unset) and awaits `revalidatePost` before returning (not fire-and-forget), and audits
 * the publish. Editing an already-published post also revalidates so its cache stays fresh.
 */
export async function updatePost(
  id: string,
  data: Record<string, unknown>,
  actorId: string,
): Promise<PostDoc> {
  const model = await getPostModel();
  const existing = await model.findById(id);
  if (!existing) throw new AppError(404, 'POST_NOT_FOUND', 'Post not found');

  const update: Record<string, unknown> = {};

  if (data.title !== undefined) {
    if (!isNonEmptyString(data.title)) throw new AppError(400, 'INVALID_POST_INPUT', 'title must be a non-empty string');
    update.title = data.title;
  }
  if (data.category !== undefined) {
    if (!isNonEmptyString(data.category)) throw new AppError(400, 'INVALID_POST_INPUT', 'category must be a non-empty string');
    update.category = data.category;
  }
  if (data.body !== undefined) update.body = data.body;
  if (data.excerpt !== undefined) update.excerpt = isNonEmptyString(data.excerpt) ? data.excerpt : '';
  if (data.coverImage !== undefined) update.coverImage = isNonEmptyString(data.coverImage) ? data.coverImage : '';
  if (data.keywords !== undefined) update.keywords = isNonEmptyString(data.keywords) ? data.keywords : '';
  if (data.ogImage !== undefined) update.ogImage = isNonEmptyString(data.ogImage) ? data.ogImage : '';
  if (data.tags !== undefined) {
    if (!isStringArray(data.tags)) throw new AppError(400, 'INVALID_POST_INPUT', 'tags must be an array of slug strings');
    update.tags = data.tags;
  }
  if (data.format !== undefined) {
    if (!isValidFormat(data.format)) throw new AppError(400, 'INVALID_POST_INPUT', `format must be one of: ${POST_FORMATS.join(', ')}`);
    update.format = data.format;
  }
  if (data.media !== undefined) {
    if (!isStringArray(data.media)) throw new AppError(400, 'INVALID_POST_INPUT', 'media must be an array of URL strings');
    update.media = data.media;
  }
  if (data.videoId !== undefined) {
    update.videoId = isNonEmptyString(data.videoId) ? data.videoId : null;
  }
  if (data.status !== undefined) {
    if (!isValidStatus(data.status)) throw new AppError(400, 'INVALID_POST_INPUT', `status must be one of: ${POST_STATUSES.join(', ')}`);
    update.status = data.status;
  }

  // Slug is editable on posts (unlike categories) — but always regenerated server-side and
  // de-duplicated, excluding this post so it doesn't collide with its own current slug.
  if (data.slug !== undefined) {
    if (!isNonEmptyString(data.slug)) throw new AppError(400, 'INVALID_POST_INPUT', 'slug must be a non-empty string');
    const nextSlug = await uniqueSlug(data.slug as string, id);
    if (!nextSlug) throw new AppError(400, 'INVALID_POST_INPUT', 'slug must contain at least one letter or number');
    update.slug = nextSlug;
  }

  // Re-check format-conditional fields against the effective (post-update) shape.
  const effFormat = (update.format as PostFormat) ?? existing.format;
  const effMedia = (update.media as string[]) ?? existing.media;
  const effVideoId = (update.videoId !== undefined ? update.videoId : existing.videoId) as string | null;
  validateFormatFields(effFormat, effMedia, effVideoId);

  const nextStatus = (update.status as PostStatus) ?? existing.status;
  const isPublishTransition = update.status === 'published' && existing.status !== 'published';

  if (data.publishedAt !== undefined) update.publishedAt = parseDate(data.publishedAt);
  if (isPublishTransition && !existing.publishedAt && update.publishedAt === undefined) {
    update.publishedAt = new Date();
  }

  const updated = await model.updateById(id, update);
  if (!updated) throw new AppError(404, 'POST_NOT_FOUND', 'Post not found');

  // Refresh the cache whenever the post is (still) live — a fresh publish or an edit to an
  // already-published post. Awaited so the client only gets 200 after the cache is updated.
  if (nextStatus === 'published') {
    await revalidatePost(updated);
  }
  if (isPublishTransition) {
    await logAudit('post.publish', 'post', id, actorId, { slug: updated.slug, title: updated.title });
  }
  return updated;
}

/** Deletes a post, purges its cached HTML + specific CloudFront paths (never `/*`), and audits. */
export async function deletePost(id: string, actorId: string): Promise<void> {
  const model = await getPostModel();
  const existing = await model.findById(id);
  if (!existing) throw new AppError(404, 'POST_NOT_FOUND', 'Post not found');

  await model.delete(id);
  await purgePost(existing);
  await logAudit('post.delete', 'post', id, actorId, { slug: existing.slug, title: existing.title });
}
