// Guards for the public write-only contact endpoint (W5B): streaming-bounded body, same-site/CSRF semantics and a
// configurable fail-closed abuse limit. No PII is ever handled or logged here.

export class BodyTooLargeError extends Error {}

/**
 * Reads at most `maxBytes` from the request stream and aborts as soon as the cap is crossed, so a chunked or
 * lying Content-Length request can never buffer more than the cap (+ one chunk) in memory.
 */
export async function readBoundedBody(request: Request, maxBytes: number): Promise<string> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) throw new BodyTooLargeError();
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

const hostOf = (value: string | null | undefined): string | undefined => {
  if (!value) return undefined;
  try {
    return new URL(value.includes('://') ? value : `http://${value}`).host.toLowerCase();
  } catch {
    return undefined;
  }
};

/**
 * Browser CSRF defence for a cookie-less public endpoint. A request is rejected when the browser says it is
 * cross-site (Sec-Fetch-Site) or when an Origin header names a host that is neither this request's Host nor the
 * configured SITE_URL. Requests with neither header (curl, server-to-server) pass: they carry no ambient browser
 * credentials, and the endpoint is write-only and bounded. Forwarded-host headers are deliberately not trusted.
 */
export function isSameSiteRequest(request: Request, siteUrl: string | undefined = process.env.SITE_URL): boolean {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') return false;
  const origin = request.headers.get('origin');
  if (origin === null) return true;
  const originHost = hostOf(origin);
  if (!originHost) return false;
  const allowed = [hostOf(request.headers.get('host')), hostOf(siteUrl)].filter(Boolean);
  return allowed.includes(originHost);
}

export type RateLimiterOptions = { max: number; windowMs: number; now?: () => number };

/**
 * Fixed-window counter held in process memory. It bounds abuse of ONE instance only: it is NOT a multi-instance
 * or production rate-limit architecture (that needs shared state at the edge/proxy and is an operator decision).
 * It is a single global bucket on purpose: client IPs from forwarded headers are attacker-controlled, so nothing
 * here keys on them. Fail-closed: once `max` is reached further requests are refused until the window rolls.
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
  const windowSeconds = int(env.CONTACT_RATE_LIMIT_WINDOW_SECONDS, 600);
  return { max: int(env.CONTACT_RATE_LIMIT_MAX, 30), windowMs: Math.max(1, windowSeconds) * 1000 };
}
