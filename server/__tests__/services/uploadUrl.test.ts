jest.mock('../../lib/s3');

import { createPresignedUpload } from '../../lib/s3';
import { getUploadUrl } from '../../services/uploadUrl';

beforeEach(() => jest.clearAllMocks());

describe('getUploadUrl', () => {
  test('returns the presigned uploadUrl + cdnUrl from S3', async () => {
    (createPresignedUpload as jest.Mock).mockResolvedValue({
      uploadUrl: 'https://s3/presigned',
      cdnUrl: 'https://cdn/media/x.jpg',
      key: 'media/x.jpg',
    });

    const result = await getUploadUrl('x.jpg', 'image/jpeg');

    expect(createPresignedUpload).toHaveBeenCalledWith('x.jpg', 'image/jpeg');
    expect(result).toEqual({ uploadUrl: 'https://s3/presigned', cdnUrl: 'https://cdn/media/x.jpg' });
  });

  test('400 when filename or type is missing', async () => {
    await expect(getUploadUrl('', 'image/jpeg')).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_UPLOAD_REQUEST' });
    await expect(getUploadUrl('x.jpg', undefined)).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_UPLOAD_REQUEST' });
    expect(createPresignedUpload).not.toHaveBeenCalled();
  });
});
