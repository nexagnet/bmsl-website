import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AnalyticsProvider } from '../../components/AnalyticsProvider';
import { SiteShell } from '../../components/SiteShell';
import { getSiteSettings } from '../../lib/cms';
import { getSiteUrl, SITE_NAME } from '../../lib/site';
import './site.css';

// Search Console verification is emitted only when SiteSettings holds a well-formed token. Having the tag does
// not prove property ownership: that needs the real account (see docs/blueprint/06-technical-blueprint.md §6.1).
export async function generateMetadata(): Promise<Metadata> {
  const { searchConsoleVerification } = await getSiteSettings();
  return {
    metadataBase: new URL(getSiteUrl()),
    title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
    description: 'Website BMSL',
    ...(searchConsoleVerification ? { verification: { google: searchConsoleVerification } } : {}),
  };
}

// Content comes from PostgreSQL and is rendered per request (no database at build time).
export const dynamic = 'force-dynamic';

export default async function FrontendLayout({ children }: { children: ReactNode }) {
  const settings = await getSiteSettings();
  return (
    <html lang="vi">
      <body>
        {/* Not rendered at all unless analytics is explicitly enabled with a valid GA4 id; consent is still required to send. */}
        {settings.analyticsEnabled && settings.ga4Id ? <AnalyticsProvider ga4Id={settings.ga4Id} /> : null}
        <SiteShell hotline={settings.hotline} zalo={settings.zalo}>
          {children}
        </SiteShell>
      </body>
    </html>
  );
}
