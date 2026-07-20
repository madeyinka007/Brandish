// ses.ts reads EMAIL_TRANSPORT once at module load, so each mode is tested via a fresh import
// (resetModules). We spy on the SES client's `send` from the freshly-required SDK so the spy is
// bound to the exact class ses.ts uses after the reset.
function loadSes(transport?: string): { ses: typeof import('../../lib/ses'); send: jest.Mock } {
  jest.resetModules();
  if (transport === undefined) delete process.env.EMAIL_TRANSPORT;
  else process.env.EMAIL_TRANSPORT = transport;
  const sdk = require('@aws-sdk/client-ses');
  const send = jest.spyOn(sdk.SESClient.prototype, 'send').mockResolvedValue({}) as unknown as jest.Mock;
  const ses = require('../../lib/ses') as typeof import('../../lib/ses');
  return { ses, send };
}

const ORIGINAL_ENV_SES = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV_SES };
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.resetModules();
  process.env = ORIGINAL_ENV_SES;
});

test('EMAIL_TRANSPORT=console logs the email and does NOT call SES', async () => {
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  const { ses, send } = loadSes('console');

  await ses.sendEmail('a@brandish.co', 'Verify your email', '<p>hi</p>');

  expect(send).not.toHaveBeenCalled();
  expect(logSpy).toHaveBeenCalled();
});

test('default transport (unset) sends via SES with the expected fields', async () => {
  process.env.SES_FROM_EMAIL = 'from@brandish.co';
  const { ses, send } = loadSes(undefined);

  await ses.sendEmail('a@brandish.co', 'Hello', '<p>x</p>');

  expect(send).toHaveBeenCalledTimes(1);
  const cmd = send.mock.calls[0][0] as any;
  expect(cmd.input.Source).toBe('from@brandish.co');
  expect(cmd.input.Destination.ToAddresses).toEqual(['a@brandish.co']);
  expect(cmd.input.Message.Subject.Data).toBe('Hello');
});
