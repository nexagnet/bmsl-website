import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SiteShell } from '../../components/SiteShell';
import { getSiteUrl, SITE_NAME } from '../../lib/site';
import './site.css';

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: 'Website BMSL',
};

// Content comes from PostgreSQL and is rendered per request (no database at build time).
export const dynamic = 'force-dynamic';

export default function FrontendLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
