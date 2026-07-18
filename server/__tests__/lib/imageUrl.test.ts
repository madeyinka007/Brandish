jest.mock('dns/promises', () => ({ lookup: jest.fn() }));

import { lookup } from 'dns/promises';
import { isPrivateAddress, validateImageUrl } from '../../lib/imageUrl';

const mockLookup = lookup as jest.Mock;
const originalFetch = global.fetch;

function mockHeadResponse(status: number, contentType: string) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? contentType : null) },
  }) as any;
}

afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

describe('isPrivateAddress', () => {
  test.each([
    ['127.0.0.1', true],       // loopback
    ['169.254.169.254', true], // link-local — the cloud metadata endpoint
    ['10.0.0.5', true],        // 10/8
    ['172.16.0.1', true],      // 172.16/12
    ['172.31.255.255', true],  // 172.16/12 upper bound
    ['192.168.1.1', true],     // 192.168/16
    ['100.64.0.1', true],      // CGNAT
    ['0.0.0.0', true],
    ['::1', true],             // IPv6 loopback
    ['fe80::1', true],         // IPv6 link-local
    ['fd00::1', true],         // IPv6 ULA
    ['::ffff:127.0.0.1', true],// IPv4-mapped loopback
    ['8.8.8.8', false],        // public
    ['1.1.1.1', false],        // public
    ['172.32.0.1', false],     // just outside 172.16/12
    ['garbage', true],         // unparseable → unsafe
  ])('isPrivateAddress(%p) === %p', (ip, expected) => {
    expect(isPrivateAddress(ip)).toBe(expected);
  });
});

describe('validateImageUrl', () => {
  test('rejects a non-http(s) protocol without any network call', async () => {
    const result = await validateImageUrl('file:///etc/passwd');
    expect(result.ok).toBe(false);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  test('rejects a URL whose host resolves to a private/link-local address (SSRF)', async () => {
    mockLookup.mockResolvedValue([{ address: '169.254.169.254' }]);
    const spy = jest.spyOn(global, 'fetch' as any);

    const result = await validateImageUrl('http://metadata.evil.test/latest/meta-data/');

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/private/);
    expect(spy).not.toHaveBeenCalled(); // never even HEADs a private host
  });

  test('rejects when the host resolves to ANY private address (mixed result)', async () => {
    mockLookup.mockResolvedValue([{ address: '8.8.8.8' }, { address: '10.0.0.1' }]);
    const result = await validateImageUrl('http://sneaky.test/x.jpg');
    expect(result.ok).toBe(false);
  });

  test('rejects a reachable public URL that is not an image', async () => {
    mockLookup.mockResolvedValue([{ address: '8.8.8.8' }]);
    mockHeadResponse(200, 'text/html; charset=utf-8');
    const result = await validateImageUrl('https://example.com/page.html');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not an image/);
  });

  test('rejects a non-2xx response', async () => {
    mockLookup.mockResolvedValue([{ address: '8.8.8.8' }]);
    mockHeadResponse(404, 'image/jpeg');
    const result = await validateImageUrl('https://example.com/missing.jpg');
    expect(result.ok).toBe(false);
  });

  test('accepts a public image URL, returning the bare mimeType', async () => {
    mockLookup.mockResolvedValue([{ address: '8.8.8.8' }]);
    mockHeadResponse(200, 'image/jpeg');
    const result = await validateImageUrl('https://cdn.example.com/photo.jpg');
    expect(result).toEqual({ ok: true, mimeType: 'image/jpeg' });
  });

  test('rejects when the host does not resolve', async () => {
    mockLookup.mockRejectedValue(new Error('ENOTFOUND'));
    const result = await validateImageUrl('https://nope.invalid/x.jpg');
    expect(result.ok).toBe(false);
  });
});
