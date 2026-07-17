import { validateRecaptcha } from '../../middleware/recaptcha';

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('validateRecaptcha', () => {
  test('400 MISSING_RECAPTCHA_TOKEN when no token is present', async () => {
    const req: any = { body: {} };
    const res = mockRes();
    const next = jest.fn();

    await validateRecaptcha(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'reCAPTCHA token required', code: 'MISSING_RECAPTCHA_TOKEN' });
    expect(next).not.toHaveBeenCalled();
  });

  test('silently returns 200 { message: "Received" } when the score is below threshold — never a 4xx', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, score: 0.3 }),
    }) as any;
    const req: any = { body: { recaptchaToken: 'tok' } };
    const res = mockRes();
    const next = jest.fn();

    await validateRecaptcha(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Received' });
    expect(next).not.toHaveBeenCalled();
  });

  test('silently returns 200 when Google reports success: false — never a 4xx', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: false, score: 0.9 }),
    }) as any;
    const req: any = { body: { recaptchaToken: 'tok' } };
    const res = mockRes();
    const next = jest.fn();

    await validateRecaptcha(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Received' });
  });

  test('silently returns 200 when the Google API call itself fails — never a 5xx', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as any;
    const req: any = { body: { recaptchaToken: 'tok' } };
    const res = mockRes();
    const next = jest.fn();

    await validateRecaptcha(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Received' });
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next() when the score is at/above threshold and Google reports success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, score: 0.9 }),
    }) as any;
    const req: any = { body: { recaptchaToken: 'tok' } };
    const res = mockRes();
    const next = jest.fn();

    await validateRecaptcha(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
