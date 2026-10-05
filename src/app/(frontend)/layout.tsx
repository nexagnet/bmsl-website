import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AnalyticsProvider } from '../../components/AnalyticsProvider';
import { JsonLd } from '../../components/JsonLd';
import { SiteShell } from '../../components/SiteShell';
import { getSiteSettings } from '../../lib/cms';
import { getSiteUrl, SITE_NAME } from '../../lib/site';
import { organizationLd } from '../../lib/structured-data';
import './site.css';

// Content comes from PostgreSQL and is rendered per request (no database at build time).
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return {
    metadataBase: new URL(getSiteUrl()),
    title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
    description: 'Website BMSL',
    // Rendered only for a validated published token. This does not prove Search Console ownership.
    ...(settings.searchConsoleVerification
      ? { verification: { google: settings.searchConsoleVerification } }
      : {}),
  };
}

export default async function FrontendLayout({ children }: { children: ReactNode }) {
  const settings = await getSiteSettings();
  return (
    <html lang="vi">
      <body>
        <SiteShell hotline={settings.hotline} zalo={settings.zalo}>
          {children}
        </SiteShell>
        <JsonLd data={organizationLd(getSiteUrl())} />
        {/* Not rendered at all (no script, listener or event) unless published settings enable analytics. */}
        {settings.analytics ? <AnalyticsProvider measurementId={settings.analytics.measurementId} /> : null}
      </body>
    </html>
  );
}
