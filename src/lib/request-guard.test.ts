import { describe, expect, it } from 'vitest';
import {
  BodyTooLargeError,
  createRateLimiter,
  isJsonContentType,
  isSameSiteRequest,
  rateLimitFromEnv,
  readBoundedBody,
  trustedOriginsFromEnv,
} from './request-guard';

const req = (init: RequestInit & { headers?: Record<string, string> } = {}) =>
  new Request('http://site.test/lien-he/gui', { method: 'POST', ...init });

const streamOf = (chunks: string[]) => {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
};

describe('readBoundedBody', () => {
  it('reads a small body', async () => {
    expect(await readBoundedBody(req({ body: '{"a":1}' }), 100)).toBe('{"a":1}');
  });

  it('rejects an oversized declared Content-Length without reading', async () => {
    await expect(readBoundedBody(req({ body: 'x', headers: { 'content-length': '999' } }), 100)).rejects.toBeInstanceOf(
      BodyTooLargeError,
    );
  });

  it('rejects a non-numeric Content-Length', async () => {
    await expect(readBoundedBody(req({ body: 'x', headers: { 'content-length': 'abc' } }), 100)).rejects.toBeInstanceOf(
      BodyTooLargeError,
    );
  });

  it('aborts a chunked stream that crosses the cap even with no Content-Length', async () => {
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new Uint8Array(64));
        if (pulled > 1000) controller.close();
      },
    });
    const request = new Request('http://site.test/x', { method: 'POST', body, duplex: 'half' } as RequestInit);
    await expect(readBoundedBody(request, 200)).rejects.toBeInstanceOf(BodyTooLargeError);
    expect(pulled).toBeLessThan(20); // cancelled early, not drained
  });

  it('counts bytes, not characters', async () => {
    const request = new Request('http://site.test/x', {
      method: 'POST',
      body: streamOf(['ệ'.repeat(40)]),
      duplex: 'half',
    } as RequestInit);
    await expect(readBoundedBody(request, 100)).rejects.toBeInstanceOf(BodyTooLargeError);
  });
});

describe('isJsonContentType', () => {
  it('accepts only application/json', () => {
    expect(isJsonContentType(req({ headers: { 'content-type': 'application/json; charset=utf-8' } }))).toBe(true);
    expect(isJsonContentType(req({ headers: { 'content-type': 'text/plain' } }))).toBe(false);
    expect(isJsonContentType(req({ headers: { 'content-type': 'application/x-www-form-urlencoded' } }))).toBe(false);
    expect(isJsonContentType(req())).toBe(false);
  });
});

describe('isSameSiteRequest (full-origin comparison against explicit trusted configuration)', () => {
  const trusted = ['https://bmsl.example'];
  const withOrigin = (origin: string, extra: Record<string, string> = {}) =>
    req({ headers: { host: 'bmsl.example', origin, ...extra } });

  it('allows the exact configured origin and header-less clients', () => {
    expect(isSameSiteRequest(withOrigin('https://bmsl.example'), trusted)).toBe(true);
    expect(isSameSiteRequest(withOrigin('https://BMSL.example:443'), trusted)).toBe(true); // default port normalises
    expect(isSameSiteRequest(req({ headers: { host: 'bmsl.example' } }), trusted)).toBe(true);
    expect(isSameSiteRequest(withOrigin('https://bmsl.example', { 'sec-fetch-site': 'same-origin' }), trusted)).toBe(true);
  });

  it('rejects the same host on another scheme or port, and look-alike hosts', () => {
    expect(isSameSiteRequest(withOrigin('http://bmsl.example'), trusted)).toBe(false);
    expect(isSameSiteRequest(withOrigin('https://bmsl.example:8443'), trusted)).toBe(false);
    expect(isSameSiteRequest(withOrigin('http://bmsl.example:443'), trusted)).toBe(false);
    expect(isSameSiteRequest(withOrigin('https://bmsl.example.evil.test'), trusted)).toBe(false);
    expect(isSameSiteRequest(withOrigin('https://sub.bmsl.example'), trusted)).toBe(false);
  });

  it('never trusts the Host header, forwarded headers or the request URL as an alternate origin', () => {
    expect(isSameSiteRequest(req({ headers: { host: 'evil.test', origin: 'https://evil.test' } }), trusted)).toBe(false);
    expect(isSameSiteRequest(req({ headers: { host: 'evil.test', origin: 'http://evil.test' } }), trusted)).toBe(false);
    expect(
      isSameSiteRequest(
        req({
          headers: {
            host: 'bmsl.example',
            origin: 'https://evil.test',
            'x-forwarded-host': 'evil.test',
            'x-forwarded-proto': 'https',
            forwarded: 'host=evil.test',
          },
        }),
        trusted,
      ),
    ).toBe(false);
    expect(isSameSiteRequest(req({ headers: { origin: 'http://site.test' } }), trusted)).toBe(false);
  });

  it('rejects cross-site Sec-Fetch-Site, the opaque null origin, other schemes and junk', () => {
    expect(isSameSiteRequest(withOrigin('https://bmsl.example', { 'sec-fetch-site': 'cross-site' }), trusted)).toBe(false);
    expect(isSameSiteRequest(withOrigin('https://bmsl.example', { 'sec-fetch-site': 'same-site' }), trusted)).toBe(false);
    for (const bad of ['null', 'file://bmsl.example', 'not a url', 'ftp://bmsl.example', '']) {
      expect(isSameSiteRequest(withOrigin(bad), trusted), bad).toBe(false);
    }
  });

  it('an empty trusted list refuses every browser Origin (fail closed)', () => {
    expect(isSameSiteRequest(withOrigin('https://bmsl.example'), [])).toBe(false);
  });
});

describe('trustedOriginsFromEnv', () => {
  it('is SITE_URL plus the explicit TRUSTED_ORIGINS, normalised, deduplicated, without invalid entries', () => {
    expect(
      trustedOriginsFromEnv({
        SITE_URL: 'https://bmsl.example/',
        TRUSTED_ORIGINS: 'https://www.bmsl.example, https://bmsl.example:443, junk, file:///x, http://staging.bmsl.example:8080',
      }),
    ).toEqual(['https://bmsl.example', 'https://www.bmsl.example', 'http://staging.bmsl.example:8080']);
  });

  it('defaults to localhost:3000 like site.ts when SITE_URL is unset, and ignores Host-like variables', () => {
    expect(trustedOriginsFromEnv({})).toEqual(['http://localhost:3000']);
    expect(trustedOriginsFromEnv({ SITE_URL: '  ', HOST: 'evil.test', VERCEL_URL: 'evil.test' })).toEqual(['http://localhost:3000']);
  });
});

describe('rate limiter', () => {
  it('refuses beyond max within the window and recovers after it', () => {
    let t = 0;
    const limiter = createRateLimiter({ max: 2, windowMs: 1000, now: () => t });
    expect([limiter.allow(), limiter.allow(), limiter.allow()]).toEqual([true, true, false]);
    t = 1000;
    expect(limiter.allow()).toBe(true);
  });

  it('max 0 fails closed', () => {
    expect(createRateLimiter({ max: 0, windowMs: 1000 }).allow()).toBe(false);
  });

  it('reads config from env and falls back on invalid values', () => {
    expect(rateLimitFromEnv({ CONTACT_RATE_LIMIT_MAX: '5', CONTACT_RATE_LIMIT_WINDOW_SECONDS: '60' })).toEqual({
      max: 5,
      windowMs: 60_000,
    });
    expect(rateLimitFromEnv({ CONTACT_RATE_LIMIT_MAX: 'abc', CONTACT_RATE_LIMIT_WINDOW_SECONDS: '-1' })).toEqual({
      max: 30,
      windowMs: 600_000,
    });
  });

  it('caps oversized env values', () => {
    expect(rateLimitFromEnv({ CONTACT_RATE_LIMIT_MAX: '999999999', CONTACT_RATE_LIMIT_WINDOW_SECONDS: '999999999' })).toEqual({
      max: 10_000,
      windowMs: 86_400_000,
    });
  });
});
