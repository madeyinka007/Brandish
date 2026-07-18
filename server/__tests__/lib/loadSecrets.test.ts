// @aws-sdk/client-ssm isn't installed locally (the Lambda runtime provides it) — a virtual
// mock stands in. The no-op paths never require it; the fetch paths drive this mock.
const mockSend = jest.fn();
const GetParametersCommand = jest.fn().mockImplementation((input) => ({ input }));
jest.mock(
  '@aws-sdk/client-ssm',
  () => ({
    SSMClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
    GetParametersCommand,
  }),
  { virtual: true },
);

const ORIGINAL_ENV_LOADSECRETS = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules(); // fresh module → fresh once-per-container cache
  process.env = { ...ORIGINAL_ENV_LOADSECRETS };
  delete process.env.AWS_LAMBDA_FUNCTION_NAME;
});

afterAll(() => {
  process.env = ORIGINAL_ENV_LOADSECRETS;
});

describe('loadSecrets', () => {
  test('no-op locally (not in Lambda) — never touches SSM', async () => {
    const { loadSecrets } = require('../../lib/loadSecrets');
    await expect(loadSecrets()).resolves.toBeUndefined();
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('no-op in Lambda when all secrets are already present', async () => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'brandish-api';
    process.env.MONGODB_URI = 'm';
    process.env.JWT_SECRET = 'j';
    process.env.RECAPTCHA_SECRET = 'r';
    const { loadSecrets } = require('../../lib/loadSecrets');
    await loadSecrets();
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('in Lambda, fetches missing secrets WithDecryption and assigns them to process.env', async () => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'brandish-api';
    process.env.SSM_SECRETS_PREFIX = '/brandish/prod';
    delete process.env.MONGODB_URI;
    delete process.env.JWT_SECRET;
    delete process.env.RECAPTCHA_SECRET;
    mockSend.mockResolvedValue({
      Parameters: [
        { Name: '/brandish/prod/MONGODB_URI', Value: 'mongo-uri' },
        { Name: '/brandish/prod/JWT_SECRET', Value: 'jwt-secret' },
        { Name: '/brandish/prod/RECAPTCHA_SECRET', Value: 'rc-secret' },
      ],
    });

    const { loadSecrets } = require('../../lib/loadSecrets');
    await loadSecrets();

    expect(GetParametersCommand).toHaveBeenCalledWith({
      Names: ['/brandish/prod/MONGODB_URI', '/brandish/prod/JWT_SECRET', '/brandish/prod/RECAPTCHA_SECRET'],
      WithDecryption: true,
    });
    expect(process.env.MONGODB_URI).toBe('mongo-uri');
    expect(process.env.JWT_SECRET).toBe('jwt-secret');
    expect(process.env.RECAPTCHA_SECRET).toBe('rc-secret');
  });

  test('caches — a second call does not fetch again', async () => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'brandish-api';
    delete process.env.MONGODB_URI;
    delete process.env.JWT_SECRET;
    delete process.env.RECAPTCHA_SECRET;
    mockSend.mockResolvedValue({
      Parameters: [
        { Name: '/brandish/prod/MONGODB_URI', Value: 'm' },
        { Name: '/brandish/prod/JWT_SECRET', Value: 'j' },
        { Name: '/brandish/prod/RECAPTCHA_SECRET', Value: 'r' },
      ],
    });
    const { loadSecrets } = require('../../lib/loadSecrets');
    await loadSecrets();
    await loadSecrets();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  test('throws when a secret is still missing after the fetch', async () => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'brandish-api';
    delete process.env.MONGODB_URI;
    delete process.env.JWT_SECRET;
    delete process.env.RECAPTCHA_SECRET;
    mockSend.mockResolvedValue({ Parameters: [{ Name: '/brandish/prod/MONGODB_URI', Value: 'only-one' }] });
    const { loadSecrets } = require('../../lib/loadSecrets');
    await expect(loadSecrets()).rejects.toThrow(/missing SSM SecureString/);
  });
});
