jest.mock('../../lib/mongodb', () => ({ getDb: jest.fn() }));
jest.mock('../../services/settings');

import * as settingsService from '../../services/settings';
import * as settingsController from '../../controllers/settings';

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => jest.clearAllMocks());

describe('getPublic controller', () => {
  test('200s with the public subset', async () => {
    (settingsService.getPublicSettings as jest.Mock).mockResolvedValue({ site: { title: 'Brandish' } });
    const res = mockRes();
    settingsController.getPublic({} as any, res, jest.fn());
    await flush();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ site: { title: 'Brandish' } });
  });
});

describe('getAdmin controller', () => {
  test('200s with the full settings', async () => {
    (settingsService.getSettings as jest.Mock).mockResolvedValue({ comments: { holdForModeration: true } });
    const res = mockRes();
    settingsController.getAdmin({} as any, res, jest.fn());
    await flush();
    expect(res.json).toHaveBeenCalledWith({ comments: { holdForModeration: true } });
  });
});

describe('update controller', () => {
  test('passes the body + acting userId and 200s', async () => {
    (settingsService.updateSettings as jest.Mock).mockResolvedValue({ updatedBy: 'u1' });
    const req: any = { body: { site: { title: 'X' } }, user: { userId: 'u1' } };
    const res = mockRes();
    settingsController.update(req, res, jest.fn());
    await flush();
    expect(settingsService.updateSettings).toHaveBeenCalledWith({ site: { title: 'X' } }, 'u1');
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
