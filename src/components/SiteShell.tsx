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

type Props = {
  children: ReactNode;
  /** Published, validated SiteSettings values only; absent means the link is not shown (never invented). */
  hotline?: { label: string; href: string };
  zalo?: { href: string };
};

export function SiteShell({ children, hotline, zalo }: Props) {
  return (
    <>
      <a className="skip-link" href="#main">
        Bỏ qua điều hướng
      </a>
      <header className="site-header">
        <div className="container header-row">
          <Link className="wordmark" href="/" aria-label={`${SITE_NAME} — Trang chủ`}>
            <span className="wordmark-badge" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18M5 21V7l8-4v18M13 21V3l6 4v14" />
              </svg>
            </span>
            <span>{SITE_NAME}</span>
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
          <div className="footer-top">
            <div className="footer-brand">
              <p className="wordmark">
                <span className="wordmark-badge" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 21h18M5 21V7l8-4v18M13 21V3l6 4v14" />
                  </svg>
                </span>
                <span>{SITE_NAME}</span>
              </p>
              <p>Dịch vụ quản lý và vận hành bất động sản chuyên nghiệp, tiêu chuẩn cao cấp.</p>
              {hotline || zalo ? (
                <div className="footer-contacts">
                  {/* data-analytics-* hooks are inert unless the opt-in analytics provider is mounted and consented. */}
                  {hotline ? (
                    <a href={hotline.href} data-analytics-event="phone_click" data-link-location="footer">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      Hotline: {hotline.label}
                    </a>
                  ) : null}
                  {zalo ? (
                    <a href={zalo.href} rel="noopener" data-analytics-event="zalo_click" data-link-location="footer">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      Zalo
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div>
              <Nav label="Điều hướng chân trang" />
            </div>
          </div>
          <div className="footer-bottom">
            <p className="muted">© {SITE_NAME}. Bản quyền được bảo lưu.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
