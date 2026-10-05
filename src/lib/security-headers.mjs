// Response security headers for the frontend and the Payload CMS/admin (W5B). Plain .mjs so next.config.mjs can
// import it; typed by security-headers.d.mts and unit-tested.
//
// CSP notes (honest limits): Next.js hydration and Payload admin emit inline scripts/styles and there is no nonce
// pipeline here, so script-src/style-src keep 'unsafe-inline'. Everything else is locked to 'self'. GA4 origins are
// added ONLY when the operator sets CSP_ALLOW_GA4=true (the measurement id itself lives in the CMS and is disabled
// by default); no wildcard or broad external origin is ever allowed.

const GA4_SCRIPT = 'https://www.googletagmanager.com';
const GA4_CONNECT = ['https://www.google-analytics.com', 'https://region1.google-analytics.com', GA4_SCRIPT];

/** @param {Record<string, string | undefined>} env */
export function buildCsp(env = {}) {
  const ga4 = env.CSP_ALLOW_GA4 === 'true';
  const directives = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", ...(ga4 ? [GA4_SCRIPT] : [])],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', ...(ga4 ? GA4_CONNECT.slice(0, 2) : [])],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", ...(ga4 ? GA4_CONNECT : [])],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'object-src': ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
}

/**
 * HSTS is emitted only when HSTS_ENABLED=true, i.e. the operator has verified HTTPS for the real domain. Sending
 * it over a plain-HTTP deployment would be wrong, and includeSubDomains/preload are deliberately not set.
 * @param {Record<string, string | undefined>} env
 */
export function buildSecurityHeaders(env = {}) {
  const headers = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Content-Security-Policy', value: buildCsp(env) },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ];
  if (env.HSTS_ENABLED === 'true') {
    headers.push({ key: 'Strict-Transport-Security', value: 'max-age=31536000' });
  }
  return headers;
}
