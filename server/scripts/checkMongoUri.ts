import 'dotenv/config';
import { MongoClient } from 'mongodb';

/**
 * Validates a MongoDB connection string BEFORE it goes into SSM.
 *
 * Rotating the Atlas password and pasting a bad URI into SSM takes the whole API down, and the
 * failure is slow to spot: the Lambda keeps serving from a warm connection pool until it
 * recycles, and the public site then answers 404 (not 500) because the page components call
 * notFound() when the data layer comes back empty. This script closes that gap — it checks the
 * string's shape, then actually authenticates against Atlas, and only then offers to store it.
 *
 * The URI is never echoed, never passed as an argv (argv is visible in `ps`), and the password
 * is redacted from every line of output including driver errors.
 *
 * Run:  npm run check:mongo                 # hidden prompt — nothing lands in shell history
 *       npm run check:mongo -- --env        # test MONGODB_URI from server/.env
 *       npm run check:mongo -- --from-ssm   # test what SSM currently holds
 *       npm run check:mongo -- --write      # on success, write it to SSM as SecureString
 */

const SSM_PARAM = `${(process.env.SSM_SECRETS_PREFIX || '/brandish/prod').replace(/\/+$/, '')}/MONGODB_URI`;
const EXPECTED_DB = 'wt-brandish'; // lib/mongodb.ts + lib/mongoose.ts both pin this
const CONNECT_TIMEOUT_MS = 15000;

// Characters that MUST be percent-encoded inside the userinfo section of a MongoDB URI.
// An unencoded '@' or '/' in a password is the single most common cause of "bad auth".
const MUST_ENCODE = ['@', ':', '/', '?', '#', '[', ']'];

export interface UriReport {
  ok: boolean;
  errors: string[];
  warnings: string[];
  info: Record<string, string>;
  /** Parsed password — used only to redact output. Never printed. */
  password?: string;
}

/** Pure structural check — no network. */
export function inspectUri(raw: string): UriReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const info: Record<string, string> = {};

  if (!raw || !raw.trim()) return { ok: false, errors: ['URI is empty.'], warnings, info };

  if (raw !== raw.trim()) {
    warnings.push('Leading/trailing whitespace was trimmed — check for a stray newline or space.');
  }
  let uri = raw.trim();

  // Pasting straight out of a .env file usually drags the quotes along with it.
  if ((uri.startsWith("'") && uri.endsWith("'")) || (uri.startsWith('"') && uri.endsWith('"'))) {
    warnings.push('Surrounding quotes were stripped — do not include them in the SSM value.');
    uri = uri.slice(1, -1);
  }

  const isSrv = uri.startsWith('mongodb+srv://');
  if (!isSrv && !uri.startsWith('mongodb://')) {
    errors.push('Must start with "mongodb+srv://" (Atlas) or "mongodb://".');
    return { ok: false, errors, warnings, info };
  }
  info.scheme = isSrv ? 'mongodb+srv (Atlas SRV)' : 'mongodb (direct)';

  // Split userinfo from host at the LAST '@' rather than the first. A naive first-'@' split
  // makes an unencoded '@' inside the password look valid — it silently truncates the password
  // at the '@' and the URI still parses, which is exactly why Atlas answers "bad auth" instead
  // of anything that points at the URI. Searching before the query string keeps an '@' in a
  // connection option from being mistaken for the userinfo delimiter.
  const afterScheme = uri.slice(uri.indexOf('://') + 3);
  const queryIdx = afterScheme.indexOf('?');
  const beforeQuery = queryIdx === -1 ? afterScheme : afterScheme.slice(0, queryIdx);

  const lastAt = beforeQuery.lastIndexOf('@');
  if (lastAt === -1) {
    // An unencoded '?' in the password opens the query string early, so the '@' ends up after
    // it and the credentials become unparseable. Name that specifically — "malformed URI" sends
    // people hunting in the wrong place.
    if (afterScheme.includes('@')) {
      errors.push(
        'Password appears to contain an unencoded "?" — percent-encode it (as %3F), ' +
          'otherwise it starts the connection-options string and truncates the credentials.',
      );
    } else {
      errors.push('Could not parse "username:password@host" — credentials look missing or malformed.');
    }
    return { ok: false, errors, warnings, info };
  }
  const userinfo = beforeQuery.slice(0, lastAt);
  const rest = afterScheme.slice(lastAt + 1);

  const colonIdx = userinfo.indexOf(':');
  if (colonIdx === -1) {
    errors.push('No password found — expected "username:password@host".');
    return { ok: false, errors, warnings, info };
  }
  const username = userinfo.slice(0, colonIdx);
  const password = userinfo.slice(colonIdx + 1);

  if (!username) errors.push('Username is empty.');
  if (!password) errors.push('Password is empty.');
  info.username = `${username.length} chars`;
  info.password = `${password.length} chars`;

  const offenders = MUST_ENCODE.filter((c) => password.includes(c));
  if (offenders.length) {
    errors.push(
      `Password contains unencoded ${offenders.map((c) => `"${c}"`).join(', ')} — ` +
        'percent-encode it (e.g. "@" becomes %40) or Atlas will reject the handshake.',
    );
  }
  if (password.includes('%') && !/%[0-9A-Fa-f]{2}/.test(password)) {
    warnings.push('Password contains a "%" that is not a valid percent-escape — likely a typo.');
  }
  if (/[<>]/.test(password) || /^<?db_?password>?$/i.test(password)) {
    errors.push('Password still looks like the Atlas placeholder (e.g. "<db_password>").');
  }

  const host = rest.split(/[/?]/)[0];
  info.host = host;
  if (isSrv && /:\d+$/.test(host)) {
    errors.push('A "mongodb+srv://" URI must not include a port number.');
  }

  const pathPart = rest.slice(host.length);
  const dbName = pathPart.startsWith('/') ? pathPart.slice(1).split('?')[0] : '';
  info.database = dbName || '(none in URI)';
  if (dbName && dbName !== EXPECTED_DB) {
    // Not fatal: both DB modules pass dbName explicitly, so the URI path is advisory.
    warnings.push(`URI database is "${dbName}" but the app pins "${EXPECTED_DB}" in code.`);
  }

  return { ok: errors.length === 0, errors, warnings, info, password };
}

/** Redacts the password from anything we print (driver errors love to echo the URI back). */
export function redact(text: string, password?: string): string {
  const masked = password ? text.split(password).join('********') : text;
  return masked.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)[^@]+@/g, '$1********@');
}

export interface ProbeResult {
  ok: boolean;
  message: string;
  detail?: string;
}

/** Live check: authenticate, ping, and confirm the app's database is readable. */
export async function probeConnection(uri: string, dbName = EXPECTED_DB): Promise<ProbeResult> {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS });
  try {
    await client.connect();
    await client.db().command({ ping: 1 });
    const names = await client.db(dbName).listCollections({}, { nameOnly: true }).toArray();
    return {
      ok: true,
      message: 'Authenticated and reachable.',
      detail: `Database "${dbName}" has ${names.length} collection(s).`,
    };
  } catch (err) {
    const e = err as { codeName?: string; name?: string; message?: string };
    const kind = e.codeName || e.name || 'Error';
    const combined = `${kind} ${e.message ?? ''}`;
    let hint = '';
    if (/bad auth|AuthenticationFailed/i.test(combined)) {
      hint =
        '\n    -> Username/password does not match Atlas. In Atlas > Database Access, confirm the ' +
        'user exists and that you clicked "Update User" after setting the password.';
    } else if (/ServerSelection|ENOTFOUND|querySrv/i.test(combined)) {
      hint =
        '\n    -> Could not reach the cluster. Check the hostname, and that your IP is allowed ' +
        'under Atlas > Network Access.';
    }
    return { ok: false, message: `${kind}: ${e.message ?? 'unknown error'}${hint}` };
  } finally {
    await client.close().catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------- CLI

const CTRL_C = '\u0003';
const BACKSPACE = '\u007f';

/** Reads a line from the TTY without echoing it, so the URI never reaches shell history. */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;

    if (!stdin.isTTY) {
      // Piped input — read it straight through.
      let piped = '';
      stdin.setEncoding('utf8');
      stdin.on('data', (d) => (piped += d));
      stdin.on('end', () => resolve(piped.trim()));
      stdin.on('error', reject);
      return;
    }

    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let buf = '';
    const onData = (chunk: string) => {
      for (const c of chunk) {
        if (c === '\n' || c === '\r') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          process.stdout.write('\n');
          resolve(buf.trim());
          return;
        }
        if (c === CTRL_C) {
          stdin.setRawMode(false);
          process.stdout.write('\n');
          process.exit(130);
        }
        if (c === BACKSPACE || c === '\b') buf = buf.slice(0, -1);
        else buf += c;
      }
    };
    stdin.on('data', onData);
  });
}

async function readFromSsm(): Promise<string> {
  const { SSMClient, GetParameterCommand } = await import('@aws-sdk/client-ssm');
  const client = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });
  const res = await client.send(new GetParameterCommand({ Name: SSM_PARAM, WithDecryption: true }));
  return res.Parameter?.Value ?? '';
}

async function writeToSsm(uri: string): Promise<void> {
  const { SSMClient, PutParameterCommand } = await import('@aws-sdk/client-ssm');
  const client = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });
  await client.send(
    new PutParameterCommand({ Name: SSM_PARAM, Value: uri, Type: 'SecureString', Overwrite: true }),
  );
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const wantsWrite = argv.includes('--write');
  let uri: string;
  let source: string;

  if (argv.includes('--from-ssm')) {
    source = `SSM ${SSM_PARAM}`;
    uri = await readFromSsm();
  } else if (argv.includes('--env')) {
    source = 'server/.env (MONGODB_URI)';
    uri = process.env.MONGODB_URI ?? '';
    if (!uri) {
      console.error('MONGODB_URI is not set in server/.env');
      return 1;
    }
  } else {
    source = 'hidden prompt';
    uri = await promptHidden('Paste the MongoDB URI (input hidden): ');
  }

  console.log(`\nSource: ${source}`);
  console.log('-'.repeat(64));

  const report = inspectUri(uri);
  const clean = uri.trim().replace(/^['"]|['"]$/g, '');

  console.log('Structure');
  for (const [k, v] of Object.entries(report.info)) {
    console.log(`  ${k.padEnd(10)} ${v}`);
  }
  for (const w of report.warnings) console.log(`  ! ${redact(w, report.password)}`);
  for (const e of report.errors) console.log(`  x ${redact(e, report.password)}`);

  if (!report.ok) {
    console.log('\nFAILED structural checks — not attempting to connect.\n');
    return 1;
  }
  console.log('  ok structure valid');

  console.log('\nConnection');
  const probe = await probeConnection(clean);
  if (!probe.ok) {
    console.log(`  x ${redact(probe.message, report.password)}`);
    console.log('\nFAILED — do NOT put this value in SSM.\n');
    return 1;
  }
  console.log(`  ok ${probe.message}`);
  if (probe.detail) console.log(`     ${probe.detail}`);

  if (wantsWrite) {
    console.log(`\nWriting to ${SSM_PARAM} (SecureString)...`);
    await writeToSsm(clean);
    console.log('  ok stored. Now recycle the Lambda so it picks the new value up:');
    console.log('     aws lambda update-function-configuration \\');
    console.log('       --function-name brandish-api-prod-BlogApiFunction-Z3yjhslnEPxe \\');
    console.log('       --region us-east-1 --description "picked up rotated MONGODB_URI"');
  } else {
    console.log(`\nPASSED. Safe to store. Re-run with --write to put it in ${SSM_PARAM}.`);
  }
  console.log('');
  return 0;
}

if (require.main === module) {
  main()
    .then((code) => process.exit(code))
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(redact(msg));
      process.exit(1);
    });
}
