jest.mock('../../services/uploadUrl');

import * as uploadUrlService from '../../services/uploadUrl';
import * as uploadUrlController from '../../controllers/uploadUrl';

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => jest.clearAllMocks());

describe('getUploadUrl controller', () => {
  test('passes filename/type from the query and 200s with the result', async () => {
    (uploadUrlService.getUploadUrl as jest.Mock).mockResolvedValue({ uploadUrl: 'u', cdnUrl: 'c' });
    const req: any = { query: { filename: 'x.jpg', type: 'image/jpeg' } };
    const res = mockRes();

    uploadUrlController.getUploadUrl(req, res, jest.fn());
    await flush();

    expect(uploadUrlService.getUploadUrl).toHaveBeenCalledWith('x.jpg', 'image/jpeg');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ uploadUrl: 'u', cdnUrl: 'c' });
  });
});
