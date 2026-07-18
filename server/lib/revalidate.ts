import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import dotenv from 'dotenv';
dotenv.config();

// ISR equivalent — replicates Vercel's on-publish revalidation manually (docs/workflows.md):
// render the post to HTML, upload it to S3, and invalidate exactly the affected CloudFront
// paths. Module-scope clients, reused across warm Lambda invocations (same rationale as the
// DB clients). CloudFront's control plane is always us-east-1 regardless of AWS_REGION.
const s3 = new S3Client({ region: process.env.AWS_REGION });
const cf = new CloudFrontClient({ region: 'us-east-1' });

/** The post fields revalidation needs — any `PostDoc` satisfies this structurally. */
export interface RevalidatePost {
  _id: string;
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  coverImage?: string;
  ogImage?: string;
}

/** S3 key of a post's cached HTML — mirrors the public URL path. */
function htmlKey(post: RevalidatePost): string {
  return `${post.category}/${post.slug}/index.html`;
}

// The two paths a post's publish/delete affects: its own page and its category listing (so
// the listing reflects the add/removal). Deliberately NOT ['/*'] — a wildcard invalidates the
// whole distribution and is slow + costly (docs/workflows.md).
function affectedPaths(post: RevalidatePost): string[] {
  return [`/${post.category}/${post.slug}`, `/${post.category}`];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Minimal cache-shell for the post: title, description and OG meta so shares/crawlers resolve
 * immediately. The rich `body` (Tiptap JSON) is rendered by the Next.js frontend, not here —
 * this shell is the pre-built template the workflow doc allows in place of a full server render.
 */
function renderPostToHTML(post: RevalidatePost): string {
  const title = escapeHtml(post.title);
  const excerpt = escapeHtml(post.excerpt ?? '');
  const image = escapeHtml(post.ogImage || post.coverImage || '');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<meta name="description" content="${excerpt}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${excerpt}">
${image ? `<meta property="og:image" content="${image}">\n` : ''}</head>
<body><article><h1>${title}</h1><p>${excerpt}</p></article></body>
</html>`;
}

async function invalidate(post: RevalidatePost): Promise<void> {
  const paths = affectedPaths(post);
  await cf.send(
    new CreateInvalidationCommand({
      DistributionId: process.env.CLOUDFRONT_DIST_ID,
      InvalidationBatch: {
        CallerReference: `${post._id}-${Date.now()}`,
        Paths: { Quantity: paths.length, Items: paths },
      },
    }),
  );
}

/**
 * Publish/update path: render → upload to S3 → invalidate the post + category paths. Awaited
 * by the caller so the API responds only after the cache is refreshed (not fire-and-forget —
 * see docs/api-routes.md).
 */
export async function revalidatePost(post: RevalidatePost): Promise<void> {
  const html = renderPostToHTML(post);
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: htmlKey(post),
      Body: html,
      ContentType: 'text/html; charset=utf-8',
      CacheControl: 'public, max-age=0, must-revalidate',
    }),
  );
  await invalidate(post);
}

/**
 * Delete path: the post is gone, so remove its cached HTML and invalidate only its specific
 * paths (never `/*`). Without this, CloudFront would keep serving a deleted post's shell.
 */
export async function purgePost(post: RevalidatePost): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: htmlKey(post) }));
  await invalidate(post);
}
