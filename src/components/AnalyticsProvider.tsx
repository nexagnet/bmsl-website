'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import {
  type AnalyticsController,
  type AnalyticsTransport,
  CONSENT_EVENT,
  createAnalytics,
  TRACK_EVENT,
} from '../lib/analytics';
import { gaCookieNames } from '../lib/consent';

type Win = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; bmslAnalytics?: unknown } & Record<string, unknown>;

const DENIED = {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
} as const;

/** Removes GA cookies on withdrawal (host and parent-domain variants); they could otherwise outlive the choice. */
function clearGaCookies() {
  const parts = location.hostname.split('.');
  const domains = ['', location.hostname, ...(parts.length > 2 ? [`.${parts.slice(-2).join('.')}`] : [`.${location.hostname}`])];
  for (const name of gaCookieNames(document.cookie)) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ''}; SameSite=Lax`;
    }
  }
}

/**
 * Real GA4 transport, constructed only in the browser and only used after consent is granted. Google Consent
 * Mode v2: every storage type is declared denied before gtag.js is requested, and analytics_storage is updated to
 * granted only on the visitor's opt-in (and back to denied on withdrawal). Ad storage/signals are never granted.
 */
function gtagTransport(win: Win): AnalyticsTransport {
  let analyticsGranted = false;
  const setAnalyticsStorage = (granted: boolean) => {
    if (analyticsGranted === granted) return;
    analyticsGranted = granted;
    win.gtag?.('consent', 'update', { analytics_storage: granted ? 'granted' : 'denied' });
  };
  return {
    load(id) {
      win.dataLayer = win.dataLayer ?? [];
      win.gtag = function gtag() {
        // gtag.js requires the `arguments` object itself, not an array copy.
        // eslint-disable-next-line prefer-rest-params
        (win.dataLayer as unknown[]).push(arguments);
      };
      win.gtag('consent', 'default', DENIED);
      win.gtag('js', new Date());
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
      document.head.appendChild(script);
    },
    config(id, params) {
      win[`ga-disable-${id}`] = false;
      setAnalyticsStorage(true);
      win.gtag?.('config', id, params);
    },
    event(name, params) {
      win.gtag?.('event', name, params);
    },
    disable(id) {
      win[`ga-disable-${id}`] = true;
      setAnalyticsStorage(false);
      clearGaCookies();
    },
  };
}

/**
 * Mounted only when published SiteSettings enable analytics with a valid GA4 id. Even then nothing loads until
 * consent is granted through window.bmslAnalytics.setConsent(true) or the `bmsl:analytics-consent` event
 * (sent by CookieConsent). Contact-form consent is unrelated.
 */
export function AnalyticsProvider({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();
  const controller = useRef<AnalyticsController | null>(null);

  useEffect(() => {
    const win = window as unknown as Win;
    const ctl = createAnalytics({
      measurementId,
      origin: window.location.origin,
      transport: gtagTransport(win),
      getPathname: () => window.location.pathname,
    });
    controller.current = ctl;
    win.bmslAnalytics = { setConsent: (granted: boolean) => ctl.setConsent(granted === true) };

    const onConsent = (event: Event) => ctl.setConsent((event as CustomEvent).detail === true);
    const onTrack = (event: Event) => {
      const detail = (event as CustomEvent).detail as { name?: unknown; params?: unknown } | null;
      ctl.track(detail?.name, detail?.params);
    };
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.('a[data-analytics-event]');
      if (!(link instanceof HTMLElement)) return;
      ctl.track(link.dataset.analyticsEvent, {
        link_location: link.dataset.linkLocation,
        document_id: link.dataset.documentId,
      });
    };
    window.addEventListener(CONSENT_EVENT, onConsent);
    window.addEventListener(TRACK_EVENT, onTrack);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener(CONSENT_EVENT, onConsent);
      window.removeEventListener(TRACK_EVENT, onTrack);
      document.removeEventListener('click', onClick);
      ctl.setConsent(false);
      delete win.bmslAnalytics;
      controller.current = null;
    };
  }, [measurementId]);

  useEffect(() => {
    controller.current?.pageView(pathname);
  }, [pathname]);

  return null;
}
