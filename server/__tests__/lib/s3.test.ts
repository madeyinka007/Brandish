process.env.AWS_REGION = 'us-east-1';
process.env.S3_BUCKET_NAME = 'test-bucket';
process.env.CF_DOMAIN = 'd1abc.cloudfront.net';

jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn().mockResolvedValue('https://s3.example/presigned') }));

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createPresignedUpload, keyFromCdnUrl } from '../../lib/s3';

describe('keyFromCdnUrl', () => {
  test.each([
    ['https://d1abc.cloudfront.net/media/123-abc.jpg', 'media/123-abc.jpg'],
    ['https://d1abc.cloudfront.net/nested/path/x.png', 'nested/path/x.png'],
    ['https://d1abc.cloudfront.net/', null],   // no key
    ['not a url', null],
  ])('keyFromCdnUrl(%p) === %p', (url, expected) => {
    expect(keyFromCdnUrl(url)).toBe(expected);
  });
});

describe('createPresignedUpload', () => {
  test('returns the presigned uploadUrl and a CloudFront cdnUrl under CF_DOMAIN', async () => {
    const result = await createPresignedUpload('cover.JPG', 'image/jpeg');

    expect(getSignedUrl).toHaveBeenCalledTimes(1);
    expect(result.uploadUrl).toBe('https://s3.example/presigned');
    expect(result.cdnUrl.startsWith('https://d1abc.cloudfront.net/')).toBe(true);
    expect(result.cdnUrl).toContain(result.key);
    expect(result.key.startsWith('media/')).toBe(true);
    expect(result.key.endsWith('.JPG')).toBe(true); // extension preserved
  });
});
