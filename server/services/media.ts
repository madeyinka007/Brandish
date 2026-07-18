import { ObjectId, type Document } from 'mongodb';
import { AppError } from '../lib/errors';
import { getDb } from '../lib/mongodb';
import { validateImageUrl } from '../lib/imageUrl';
import { deleteObject, keyFromCdnUrl } from '../lib/s3';
import { isNonEmptyString } from '../lib/validation';

// ⚠ Native-driver module — the `media` collection is native-driver-only (see the ODM split
// in docs/data-model.md), so this service talks to `getDb()` directly. There is NO Mongoose
// model and NO BaseModel here — deliberately unlike every Mongoose-backed module.

const COLLECTION = 'media';
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function collection() {
  return getDb().then((db) => db.collection(COLLECTION));
}

export async function listMedia(page = 1, limit = DEFAULT_LIMIT): Promise<Document[]> {
  const p = Math.max(1, page);
  const l = Math.min(Math.max(1, limit), MAX_LIMIT);
  const col = await collection();
  return col.find({}).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).toArray();
}

export interface UploadMediaInput {
  filename?: unknown;
  url?: unknown;
  size?: unknown;
  mimeType?: unknown;
}

/** Records a file the browser already uploaded straight to S3 (Path A). */
export async function createFromUpload(data: UploadMediaInput, userId: string): Promise<Document> {
  const { filename, url, size, mimeType } = data;
  if (!isNonEmptyString(filename) || !isNonEmptyString(url)) {
    throw new AppError(400, 'INVALID_MEDIA_INPUT', 'filename and url are required for an upload');
  }
  // Integrity: an 'upload' url must be a CloudFront URL we handed out — never an arbitrary
  // external URL (that's what source 'url' is for). Guards against mislabeling.
  if (process.env.CF_DOMAIN && !url.startsWith(`https://${process.env.CF_DOMAIN}/`)) {
    throw new AppError(400, 'INVALID_MEDIA_INPUT', 'upload url must be a CloudFront URL');
  }
  const doc = {
    source: 'upload' as const,
    filename,
    url,
    size: typeof size === 'number' ? size : null,
    mimeType: isNonEmptyString(mimeType) ? mimeType : null,
    uploadedBy: new ObjectId(userId),
    createdAt: new Date(),
  };
  const col = await collection();
  const { insertedId } = await col.insertOne(doc);
  return { ...doc, _id: insertedId };
}

/** Records an already-hosted image by URL (Path B) — validated by the SSRF guard first. */
export async function createFromUrl(url: unknown, userId: string): Promise<Document> {
  if (!isNonEmptyString(url)) {
    throw new AppError(400, 'INVALID_MEDIA_INPUT', 'url is required');
  }
  const check = await validateImageUrl(url);
  if (!check.ok) {
    throw new AppError(422, 'INVALID_MEDIA_URL', 'URL is not a reachable image');
  }
  const doc = {
    source: 'url' as const,
    filename: null,
    url, // stored as-is — served directly from the source, not CloudFront
    size: null, // never downloaded, so size is unknown
    mimeType: check.mimeType ?? null,
    uploadedBy: new ObjectId(userId),
    createdAt: new Date(),
  };
  const col = await collection();
  const { insertedId } = await col.insertOne(doc);
  return { ...doc, _id: insertedId };
}

/** Dispatches on `source` — keeps the branch in the service, not the controller. */
export async function createMedia(body: any, userId: string): Promise<Document> {
  const source = body?.source;
  if (source === 'upload') return createFromUpload(body, userId);
  if (source === 'url') return createFromUrl(body?.url, userId);
  throw new AppError(400, 'INVALID_MEDIA_SOURCE', 'source must be "upload" or "url"');
}

export async function deleteMedia(id: string): Promise<void> {
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    throw new AppError(400, 'INVALID_ID', 'Invalid media id');
  }
  const col = await collection();
  const media = await col.findOne({ _id: oid });
  if (!media) throw new AppError(404, 'MEDIA_NOT_FOUND', 'Media not found');

  // For an uploaded file, remove the S3 object too — the one place this service touches S3,
  // as a side effect of owning the record's lifecycle (see docs/api-routes.md). A URL
  // reference points at someone else's host, so there's nothing of ours to delete.
  if (media.source === 'upload') {
    const key = keyFromCdnUrl(media.url);
    if (key) await deleteObject(key);
  }
  await col.deleteOne({ _id: oid });
}
