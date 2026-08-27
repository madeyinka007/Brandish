import { inspectUri, redact } from '../../scripts/checkMongoUri';

// The structural half of the checker is pure, so it is unit-tested here with fake URIs.
// probeConnection() is deliberately not covered — it does real network I/O against Atlas,
// which is exactly what the script is for and what the test suite must never do.

const HOST = 'wt-brandish.cosua6n.mongodb.net';
const good = `mongodb+srv://appuser:s3cretpassword@${HOST}/wt-brandish?retryWrites=true&w=majority`;

describe('inspectUri', () => {
  it('accepts a well-formed Atlas SRV URI', () => {
    const r = inspectUri(good);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.info.host).toBe(HOST);
    expect(r.info.database).toBe('wt-brandish');
  });

  it('rejects an empty string', () => {
    expect(inspectUri('').ok).toBe(false);
    expect(inspectUri('   ').ok).toBe(false);
  });

  it('rejects a non-mongodb scheme', () => {
    const r = inspectUri(`https://appuser:pw@${HOST}`);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/must start with/i);
  });

  it('rejects a URI with no credentials', () => {
    const r = inspectUri(`mongodb+srv://${HOST}/wt-brandish`);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/username:password/i);
  });

  // The headline case: an unencoded '@' silently truncates the password and Atlas
  // answers "bad auth", which reads like a wrong password rather than a bad URI.
  it.each(['@', '/', '?', '#', ':'])('flags unencoded %s in the password', (ch) => {
    const r = inspectUri(`mongodb+srv://appuser:pa${ch}ss@${HOST}/wt-brandish`);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/percent-encode/i);
  });

  it('accepts a password that is already percent-encoded', () => {
    const r = inspectUri(`mongodb+srv://appuser:pa%40ss@${HOST}/wt-brandish`);
    expect(r.ok).toBe(true);
  });

  it('warns on a lone % that is not a valid escape', () => {
    const r = inspectUri(`mongodb+srv://appuser:pa%ss@${HOST}/wt-brandish`);
    expect(r.warnings.join(' ')).toMatch(/percent-escape/i);
  });

  it('rejects the Atlas placeholder password', () => {
    const r = inspectUri(`mongodb+srv://appuser:<db_password>@${HOST}/wt-brandish`);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/placeholder/i);
  });

  it('strips surrounding quotes copied out of a .env file and warns', () => {
    const r = inspectUri(`'${good}'`);
    expect(r.ok).toBe(true);
    expect(r.warnings.join(' ')).toMatch(/quotes/i);
  });

  it('warns about surrounding whitespace but still validates', () => {
    const r = inspectUri(`  ${good}\n`);
    expect(r.ok).toBe(true);
    expect(r.warnings.join(' ')).toMatch(/whitespace/i);
  });

  it('rejects a port on an +srv URI', () => {
    const r = inspectUri(`mongodb+srv://appuser:pw@${HOST}:27017/wt-brandish`);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/must not include a port/i);
  });

  it('warns when the URI database differs from the one the app pins', () => {
    const r = inspectUri(`mongodb+srv://appuser:pw@${HOST}/some-other-db`);
    expect(r.ok).toBe(true);
    expect(r.warnings.join(' ')).toMatch(/wt-brandish/);
  });

  it('never reports the password itself in info', () => {
    const r = inspectUri(good);
    expect(JSON.stringify(r.info)).not.toContain('s3cretpassword');
    expect(r.info.password).toBe('14 chars');
  });
});

describe('redact', () => {
  it('masks the password when given it explicitly', () => {
    expect(redact('failed for s3cretpassword', 's3cretpassword')).toBe('failed for ********');
  });

  it('masks credentials inside a URI even without the password', () => {
    expect(redact(`connect ECONNREFUSED ${good}`)).not.toContain('s3cretpassword');
    expect(redact(`connect ECONNREFUSED ${good}`)).toContain('********@');
  });

  it('leaves unrelated text untouched', () => {
    expect(redact('bad auth : authentication failed')).toBe('bad auth : authentication failed');
  });
});
