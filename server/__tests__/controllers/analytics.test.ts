jest.mock('../../lib/mongodb', () => ({ getDb: jest.fn() }));
jest.mock('../../services/analytics', () => ({ getAnalytics: jest.fn() }));

import * as analyticsService from '../../services/analytics';
import * as analyticsController from '../../controllers/analytics';

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => jest.clearAllMocks());

describe('getAnalytics controller', () => {
  test('parses ?days and 200s with the overview', async () => {
    (analyticsService.getAnalytics as jest.Mock).mockResolvedValue({ rangeDays: 7 });
    const res = mockRes();
    analyticsController.getAnalytics({ query: { days: '7' } } as any, res, jest.fn());
    await flush();
    expect(analyticsService.getAnalytics).toHaveBeenCalledWith(7);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ rangeDays: 7 });
  });

  test('passes undefined when ?days is missing/invalid (service applies its default)', async () => {
    (analyticsService.getAnalytics as jest.Mock).mockResolvedValue({ rangeDays: 30 });
    const res = mockRes();
    analyticsController.getAnalytics({ query: {} } as any, res, jest.fn());
    await flush();
    expect(analyticsService.getAnalytics).toHaveBeenCalledWith(undefined);
  });
});
