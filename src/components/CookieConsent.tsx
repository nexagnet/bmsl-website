'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CONSENT_EVENT } from '../lib/analytics';
import {
  COOKIE_POLICY_PATH,
  OPEN_COOKIE_SETTINGS_EVENT,
  readConsent,
  writeConsent,
} from '../lib/consent';

const getStorage = (): Storage | undefined => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

/**
 * Consent banner for analytics cookies. Mounted only when analytics is configured (published GA4 id). Default is
 * "refused": nothing is sent until the visitor presses "Đồng ý". The choice is stored in localStorage and can be
 * changed through the footer link "Cài đặt cookie". Must render after AnalyticsProvider so its listener exists.
 */
export function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const reopened = useRef(false);

  useEffect(() => {
    const saved = readConsent(getStorage());
    if (saved) {
      setAnalytics(saved.analytics);
      window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: saved.analytics }));
    } else {
      setOpen(true);
    }
    const reopen = () => {
      reopened.current = true;
      setOpen(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
  }, []);

  // Reopened on request: move focus into the panel so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (open && reopened.current) panel.current?.focus();
  }, [open]);

  const choose = useCallback((granted: boolean) => {
    writeConsent(getStorage(), granted);
    setAnalytics(granted);
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: granted }));
    setOpen(false);
    reopened.current = false;
    // Hand focus back to a sensible place after the panel disappears.
    document.querySelector<HTMLElement>('[data-cookie-settings]')?.focus();
  }, []);

  if (!open) return null;
  return (
    <div
      ref={panel}
      className="cookie-banner"
      role="region"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-text"
      tabIndex={-1}
      data-cookie-banner
    >
      <div className="cookie-banner-body">
        <h2 id="cookie-banner-title">Cookie trên website BMSL</h2>
        <p id="cookie-banner-text">
          Chúng tôi chỉ dùng cookie phân tích (Google Analytics) để hiểu cách website được sử dụng, và chỉ khi bạn đồng ý.
          Nếu từ chối, không có dữ liệu phân tích nào được gửi đi. Bạn có thể đổi lựa chọn bất cứ lúc nào qua liên kết
          &quot;Cài đặt cookie&quot; ở cuối trang.{' '}
          <Link href={COOKIE_POLICY_PATH}>Xem Chính sách cookie</Link>.
        </p>
        <p className="cookie-banner-state" aria-live="polite">
          {analytics ? 'Hiện tại: đã đồng ý cookie phân tích.' : 'Hiện tại: chưa đồng ý cookie phân tích.'}
        </p>
      </div>
      <div className="cookie-banner-actions">
        <button type="button" className="button secondary" onClick={() => choose(false)} data-cookie-reject>
          Từ chối
        </button>
        <button type="button" className="button" onClick={() => choose(true)} data-cookie-accept>
          Đồng ý
        </button>
      </div>
    </div>
  );
}

/** Footer control that reopens the banner. Rendered only together with the banner. */
export function CookieSettingsButton() {
  return (
    <button
      type="button"
      className="footer-link-button"
      data-cookie-settings
      onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))}
    >
      Cài đặt cookie
    </button>
  );
}
