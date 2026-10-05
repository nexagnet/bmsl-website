// Guards for the public write-only contact endpoint (W5B): streaming-bounded body, same-site/CSRF semantics and a
// configurable fail-closed abuse limit. No PII is ever handled or logged here.

export class BodyTooLargeError extends Error {}

/**
 * Reads at most `maxBytes` from the request stream and aborts as soon as the cap is crossed, so a chunked or
 * lying Content-Length request can never buffer more than the cap (+ one chunk) in memory.
 */
export async function readBoundedBody(request: Request, maxBytes: number): Promise<string> {
  const declaredHeader = request.headers.get('content-length');
  if (declaredHeader !== null) {
    // A malformed Content-Length is treated as invalid rather than silently skipping the early reject.
    if (!/^\d+$/.test(declaredHeader.trim()) || Number(declaredHeader) > maxBytes) throw new BodyTooLargeError();
  }
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks));
}

export const isJsonContentType = (request: Request): boolean =>
  /^application\/json\s*(;|$)/i.test(request.headers.get('content-type') ?? '');

/** Canonical scheme://host[:port] of an http(s) URL; anything else (opaque "null", other schemes, junk) is undefined. */
export const originOf = (value: string | null | undefined): string | undefined => {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : undefined;
  } catch {
    return undefined;
  }
};

/**
 * The only origins accepted as "this site": the origin of SITE_URL (localhost:3000 when unset, like site.ts) plus
 * the explicit comma-separated TRUSTED_ORIGINS list for approved alternates such as a www host. Each entry is a full
 * origin (scheme + host + port); unparsable entries are dropped, never repaired.
 */
export function trustedOriginsFromEnv(env: Record<string, string | undefined> = process.env): string[] {
  const configured = [env.SITE_URL?.trim() || 'http://localhost:3000', ...(env.TRUSTED_ORIGINS ?? '').split(',')];
  return [...new Set(configured.map(originOf).filter((o): o is string => o !== undefined))];
}

/**
 * Browser CSRF defence for a cookie-less public endpoint. A request is rejected when the browser says it is
 * cross-site (Sec-Fetch-Site) or when an Origin header is not exactly one of the trusted origins: scheme, host AND
 * port must all match, so http vs https or another port of the same host is a different origin. The request's own
 * Host header and every X-Forwarded-* header are attacker-influenced and are deliberately NOT trusted as origins;
 * behind a proxy the operator sets SITE_URL / TRUSTED_ORIGINS. Requests with neither Sec-Fetch-Site nor Origin (curl,
 * server-to-server) pass: they carry no ambient browser credentials, and the endpoint is write-only and bounded.
 */
export function isSameSiteRequest(request: Request, trustedOrigins: string[] = trustedOriginsFromEnv()): boolean {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') return false;
  const origin = request.headers.get('origin');
  if (origin === null) return true;
  const normalized = originOf(origin);
  return normalized !== undefined && trustedOrigins.includes(normalized);
}

export type RateLimiterOptions = { max: number; windowMs: number; now?: () => number };

/**
 * Fixed-window counter held in process memory. It bounds abuse of ONE instance only: it is NOT a multi-instance
 * or production rate-limit architecture (that needs shared state at the edge/proxy and is an operator decision).
 * It is a single global bucket on purpose: client IPs from forwarded headers are attacker-controlled, so nothing
 * here keys on them. Fail-closed: once `max` is reached further requests are refused until the window rolls.
 * Trade-off: because the bucket is global, a hostile client can exhaust it and lock out legitimate leads until the
 * window rolls; this is accepted over trusting spoofable IPs, and real mitigation belongs at the edge/proxy.
 * max <= 0 means "refuse everything", never "unlimited".
 */
export function createRateLimiter({ max, windowMs, now = Date.now }: RateLimiterOptions) {
  let windowStart = now();
  let count = 0;
  return {
    allow(): boolean {
      const t = now();
      if (t - windowStart >= windowMs) {
        windowStart = t;
        count = 0;
      }
      if (count >= max) return false;
      count += 1;
      return true;
    },
  };
}

/** Reads CONTACT_RATE_LIMIT_MAX / CONTACT_RATE_LIMIT_WINDOW_SECONDS; invalid values fall back to safe defaults. */
export function rateLimitFromEnv(env: Record<string, string | undefined> = process.env): RateLimiterOptions {
  const int = (v: string | undefined, fallback: number) => {
    const n = Number(v);
    return v !== undefined && v.trim() !== '' && Number.isInteger(n) && n >= 0 ? n : fallback;
  };
  // Upper caps keep a typo from silently making the limiter effectively unlimited or never rolling.
  const windowSeconds = Math.min(86_400, int(env.CONTACT_RATE_LIMIT_WINDOW_SECONDS, 600));
  const max = Math.min(10_000, int(env.CONTACT_RATE_LIMIT_MAX, 30));
  return { max, windowMs: Math.max(1, windowSeconds) * 1000 };
}
