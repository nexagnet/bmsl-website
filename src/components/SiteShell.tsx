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

export function SiteShell({ children }: { children: ReactNode }) {
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
          <p className="muted">© {SITE_NAME}</p>
        </div>
      </footer>
    </>
  );
}
