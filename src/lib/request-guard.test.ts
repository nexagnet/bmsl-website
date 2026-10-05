import { describe, expect, it } from 'vitest';
import {
  BodyTooLargeError,
  createRateLimiter,
  isJsonContentType,
  isSameSiteRequest,
  rateLimitFromEnv,
  readBoundedBody,
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

describe('isSameSiteRequest', () => {
  it('allows same-origin, the configured SITE_URL and header-less clients', () => {
    expect(isSameSiteRequest(req({ headers: { host: 'site.test', origin: 'http://site.test' } }), undefined)).toBe(true);
    expect(isSameSiteRequest(req({ headers: { host: 'internal:3000', origin: 'https://bmsl.example' } }), 'https://bmsl.example')).toBe(true);
    expect(isSameSiteRequest(req({ headers: { host: 'site.test' } }), undefined)).toBe(true);
  });

  it('rejects cross-site Origin, Sec-Fetch-Site and unparsable Origin; ignores forwarded host', () => {
    expect(isSameSiteRequest(req({ headers: { host: 'site.test', origin: 'https://evil.test' } }), undefined)).toBe(false);
    expect(isSameSiteRequest(req({ headers: { host: 'site.test', 'sec-fetch-site': 'cross-site' } }), undefined)).toBe(false);
    expect(isSameSiteRequest(req({ headers: { host: 'site.test', 'sec-fetch-site': 'same-site' } }), undefined)).toBe(false);
    expect(isSameSiteRequest(req({ headers: { host: 'site.test', origin: 'null' } }), undefined)).toBe(false);
    expect(
      isSameSiteRequest(req({ headers: { host: 'site.test', origin: 'https://evil.test', 'x-forwarded-host': 'evil.test' } }), undefined),
    ).toBe(false);
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
