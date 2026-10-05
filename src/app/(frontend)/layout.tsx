import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Analytics } from '../../components/Analytics';
import { SiteShell } from '../../components/SiteShell';
import { getSiteSettings } from '../../lib/cms';
import { getSiteUrl, SITE_NAME } from '../../lib/site';
import './site.css';

// Content comes from PostgreSQL and is rendered per request (no database at build time).
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return {
    metadataBase: new URL(getSiteUrl()),
    title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
    description: 'Website BMSL',
    // Only a validated token from PUBLISHED settings. Rendering it does not prove property ownership.
    ...(settings.searchConsoleVerification ? { verification: { google: settings.searchConsoleVerification } } : {}),
  };
}

export default async function FrontendLayout({ children }: { children: ReactNode }) {
  const settings = await getSiteSettings();
  return (
    <html lang="vi">
      <body>
        <SiteShell settings={settings}>{children}</SiteShell>
        {/* Rendered only with the explicit enable switch + valid GA4 id; still silent until analytics consent. */}
        {settings.ga4Id ? <Analytics ga4Id={settings.ga4Id} /> : null}
      </body>
    </html>
  );
}
