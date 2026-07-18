import { AppError } from '../lib/errors';
import { createPresignedUpload } from '../lib/s3';
import { isNonEmptyString } from '../lib/validation';

// Talks to S3 only — no database access at all (a presigned URL is minted before any
// media record exists; the record is created later via the media service).
export async function getUploadUrl(filename: unknown, type: unknown): Promise<{ uploadUrl: string; cdnUrl: string }> {
  if (!isNonEmptyString(filename) || !isNonEmptyString(type)) {
    throw new AppError(400, 'INVALID_UPLOAD_REQUEST', 'filename and type query params are required');
  }
  const { uploadUrl, cdnUrl } = await createPresignedUpload(filename, type);
  return { uploadUrl, cdnUrl };
}
