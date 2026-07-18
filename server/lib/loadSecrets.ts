// Runtime secret loader. CloudFormation cannot inject SSM *SecureString* values into Lambda
// env vars ({{resolve:ssm-secure:...}} is not permitted there), so instead of baking the three
// secrets into the template we fetch them once, at cold start, straight from SSM Parameter
// Store with decryption — and set them on process.env before anything reads them.
//
// Local dev/tests never hit this path: dotenv has already populated these from server/.env, and
// we're not in Lambda, so loadSecrets() is a no-op. The @aws-sdk/client-ssm import is a lazy
// require for the same reason — it's only resolved inside Lambda (where the runtime provides the
// SDK), so it never needs to be installed locally.

const SECRET_KEYS = ['MONGODB_URI', 'JWT_SECRET', 'RECAPTCHA_SECRET'] as const;
const DEFAULT_PREFIX = '/brandish/prod';

let loadPromise: Promise<void> | null = null;

async function fetchAndAssign(): Promise<void> {
  // Not in Lambda (local dev/test), or dotenv already provided everything → nothing to do.
  const inLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
  const alreadySet = SECRET_KEYS.every((k) => !!process.env[k]);
  if (!inLambda || alreadySet) return;

  const prefix = (process.env.SSM_SECRETS_PREFIX || DEFAULT_PREFIX).replace(/\/+$/, '');
  const names = SECRET_KEYS.map((k) => `${prefix}/${k}`);

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { SSMClient, GetParametersCommand } = require('@aws-sdk/client-ssm');
  const client = new SSMClient({ region: process.env.AWS_REGION });
  const res = await client.send(new GetParametersCommand({ Names: names, WithDecryption: true }));

  for (const p of res.Parameters ?? []) {
    const key = String(p.Name).slice(prefix.length + 1);
    if ((SECRET_KEYS as readonly string[]).includes(key) && p.Value) {
      process.env[key] = p.Value;
    }
  }

  const missing = SECRET_KEYS.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`loadSecrets: missing SSM SecureString parameters under ${prefix}: ${missing.join(', ')}`);
  }
}

/** Idempotent: fetches the SecureString secrets into process.env exactly once per warm container. */
export function loadSecrets(): Promise<void> {
  if (!loadPromise) loadPromise = fetchAndAssign();
  return loadPromise;
}
