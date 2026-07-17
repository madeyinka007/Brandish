jest.mock('../../lib/dynamo', () => ({
  checkRateLimit: jest.fn(),
}));

import { checkRateLimit } from '../../lib/dynamo';
import { rateLimit } from '../../middleware/rateLimit';

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  (checkRateLimit as jest.Mock).mockReset();
});

describe('rateLimit', () => {
  test('calls next() when checkRateLimit allows the request', async () => {
    (checkRateLimit as jest.Mock).mockResolvedValue(true);
    const req: any = { headers: {}, ip: '9.9.9.9' };
    const res = mockRes();
    const next = jest.fn();

    await rateLimit(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('429 RATE_LIMITED when checkRateLimit denies the request', async () => {
    (checkRateLimit as jest.Mock).mockResolvedValue(false);
    const req: any = { headers: {}, ip: '9.9.9.9' };
    const res = mockRes();
    const next = jest.fn();

    await rateLimit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({ error: 'Too Many Requests', code: 'RATE_LIMITED' });
    expect(next).not.toHaveBeenCalled();
  });

  test('prefers x-forwarded-for over req.ip, taking the first entry of a comma-separated list', async () => {
    (checkRateLimit as jest.Mock).mockResolvedValue(true);
    const req: any = { headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }, ip: '9.9.9.9' };
    const res = mockRes();
    const next = jest.fn();

    await rateLimit(req, res, next);

    expect(checkRateLimit).toHaveBeenCalledWith('1.1.1.1');
  });

  test('handles x-forwarded-for being an array (repeated header)', async () => {
    (checkRateLimit as jest.Mock).mockResolvedValue(true);
    const req: any = { headers: { 'x-forwarded-for': ['3.3.3.3', '4.4.4.4'] }, ip: '9.9.9.9' };
    const res = mockRes();
    const next = jest.fn();

    await rateLimit(req, res, next);

    expect(checkRateLimit).toHaveBeenCalledWith('3.3.3.3');
  });

  test('falls back to req.ip when x-forwarded-for is absent', async () => {
    (checkRateLimit as jest.Mock).mockResolvedValue(true);
    const req: any = { headers: {}, ip: '9.9.9.9' };
    const res = mockRes();
    const next = jest.fn();

    await rateLimit(req, res, next);

    expect(checkRateLimit).toHaveBeenCalledWith('9.9.9.9');
  });
});
