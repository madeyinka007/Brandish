import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Centralized S3 access for the media module. Module-scope client, reused across warm
// Lambda invocations (same rationale as the DB clients).
const s3 = new S3Client({ region: process.env.AWS_REGION });

const PRESIGN_EXPIRY_SECONDS = 60;

export interface PresignedUpload {
  uploadUrl: string; // S3 presigned PUT — the browser uploads directly to this
  cdnUrl: string;    // permanent CloudFront URL to store in the media record
  key: string;
}

/** Mints a presigned `PutObject` URL (60s) plus the CloudFront URL the object will be served from. */
export async function createPresignedUpload(filename: string, contentType: string): Promise<PresignedUpload> {
  const ext = filename.includes('.') ? filename.split('.').pop() : '';
  const key = `media/${Date.now()}-${Math.random().toString(36).slice(2)}${ext ? `.${ext}` : ''}`;

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: key, ContentType: contentType }),
    { expiresIn: PRESIGN_EXPIRY_SECONDS },
  );

  const cdnUrl = `https://${process.env.CF_DOMAIN}/${key}`;
  return { uploadUrl, cdnUrl, key };
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: key }));
}

/** Extracts the S3 key from a CloudFront URL (`https://{CF_DOMAIN}/{key}`); null if it doesn't parse. */
export function keyFromCdnUrl(url: string): string | null {
  try {
    const key = new URL(url).pathname.replace(/^\/+/, '');
    return key || null;
  } catch {
    return null;
  }
}
