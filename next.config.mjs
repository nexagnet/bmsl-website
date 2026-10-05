import { withPayload } from '@payloadcms/next/withPayload';

const noindex = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      { source: '/admin/:path*', headers: noindex },
      { source: '/api/:path*', headers: noindex },
    ];
  },
};

export default withPayload(nextConfig);
