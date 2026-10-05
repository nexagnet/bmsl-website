import process from 'node:process';
import { withPayload } from '@payloadcms/next/withPayload';
import {
  buildRedirectRules,
  loadLegacyManifest,
  toNextRedirects,
  validateRedirectRules,
} from './src/migration/legacy.mjs';
import { buildSecurityHeaders } from './src/lib/security-headers.mjs';

const noindex = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }];

// Legacy WordPress redirects (docs/migration). Fail closed: an unsafe rule set stops the build.
const legacyRules = buildRedirectRules(loadLegacyManifest());
const problems = validateRedirectRules(legacyRules);
if (problems.length > 0) throw new Error(`Invalid legacy redirect rules:\n${problems.join('\n')}`);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Without this Next answers /legacy-slug/ with its own 308 to /legacy-slug and only then applies our 301
  // (a chain). Rule sources are slash-less and Next matches both /x and /x/ directly.
  skipTrailingSlashRedirect: true,
  // /_next/image would cache transformed bytes of MediaAsset files without a new rights check, so APPROVED media
  // revoked later would still be served. Disabled (404) until a rights-aware pipeline exists (W5B).
  images: { unoptimized: true },
  async redirects() {
    return toNextRedirects(legacyRules);
  },
  async headers() {
    return [
      { source: '/:path*', headers: buildSecurityHeaders(process.env) },
      { source: '/admin/:path*', headers: noindex },
      { source: '/api/:path*', headers: noindex },
    ];
  },
};

export default withPayload(nextConfig);
