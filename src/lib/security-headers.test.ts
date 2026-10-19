import { describe, expect, it } from 'vitest';
import { buildCsp, buildSecurityHeaders } from './security-headers.mjs';

const get = (env: Record<string, string>, key: string) =>
  buildSecurityHeaders(env).find((h) => h.key === key)?.value;

describe('security headers', () => {
  it('always sends nosniff, referrer policy and frame protection', () => {
    expect(get({}, 'X-Content-Type-Options')).toBe('nosniff');
    expect(get({}, 'Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(get({}, 'X-Frame-Options')).toBe('DENY');
    expect(get({}, 'Content-Security-Policy')).toContain("frame-ancestors 'none'");
  });

  it('sends HSTS only when the operator verified HTTPS', () => {
    expect(get({}, 'Strict-Transport-Security')).toBeUndefined();
    expect(get({ HSTS_ENABLED: 'yes' }, 'Strict-Transport-Security')).toBeUndefined();
    expect(get({ HSTS_ENABLED: 'true' }, 'Strict-Transport-Security')).toBe('max-age=31536000');
  });

  it('allows framing only the OpenStreetMap origin', () => {
    expect(buildCsp({})).toContain("frame-src 'self' https://www.openstreetmap.org;");
  });

  it('adds only the explicit GA4 origins when configured and never a wildcard', () => {
    const off = buildCsp({});
    expect(off).not.toContain('googletagmanager');
    const on = buildCsp({ CSP_ALLOW_GA4: 'true' });
    expect(on).toContain("script-src 'self' 'unsafe-inline' https://www.googletagmanager.com");
    expect(on).toContain('https://region1.google-analytics.com');
    for (const csp of [off, on]) {
      expect(csp).not.toMatch(/\s\*[\s;]|https:(?:\s|;|$)/);
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("default-src 'self'");
    }
  });
});
