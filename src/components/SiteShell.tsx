import Link from 'next/link';
import type { ReactNode } from 'react';
import { NAV_ITEMS, SITE_NAME, SURVEY_CTA } from '../lib/site';

function Nav({ label }: { label: string }) {
  return (
    <nav aria-label={label}>
      <ul className="nav-list">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <Link href={item.href}>{item.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

type ContactLink = { label: string; href: string };

export function SiteShell({
  children,
  hotline,
  zalo,
}: {
  children: ReactNode;
  /** Published, validated SiteSettings values only; absent means nothing is rendered (no invented numbers). */
  hotline?: ContactLink;
  zalo?: ContactLink;
}) {
  return (
    <>
      <a className="skip-link" href="#main">
        Bỏ qua điều hướng
      </a>
      <header className="site-header">
        <div className="container header-row">
          <Link className="wordmark" href="/" aria-label={`${SITE_NAME} — Trang chủ`}>
            {SITE_NAME}
          </Link>
          {/* Mobile menu is a native disclosure: keyboard- and screen-reader-operable without JavaScript. */}
          <details className="mobile-menu">
            <summary>Menu</summary>
            <Nav label="Điều hướng chính (di động)" />
          </details>
          <div className="desktop-nav">
            <Nav label="Điều hướng chính" />
          </div>
          <Link className="button" href={SURVEY_CTA.href}>
            {SURVEY_CTA.label}
          </Link>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <footer className="site-footer">
        <div className="container">
          <p className="wordmark">{SITE_NAME}</p>
          <Nav label="Điều hướng chân trang" />
          {hotline || zalo ? (
            <p>
              {hotline ? (
                <a href={hotline.href} data-analytics-event="phone_click" data-analytics-location="footer">
                  Hotline: {hotline.label}
                </a>
              ) : null}
              {hotline && zalo ? ' · ' : null}
              {zalo ? (
                <a
                  href={zalo.href}
                  rel="noopener noreferrer"
                  target="_blank"
                  data-analytics-event="zalo_click"
                  data-analytics-location="footer"
                >
                  Zalo: {zalo.label}
                </a>
              ) : null}
            </p>
          ) : null}
          <p className="muted">© {SITE_NAME}</p>
        </div>
      </footer>
    </>
  );
}
