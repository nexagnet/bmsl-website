'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import {
  ANALYTICS_BROWSER_EVENT,
  ANALYTICS_CONSENT_EVENT,
  createAnalytics,
  isAnalyticsEvent,
} from '../lib/analytics';

declare global {
  interface Window {
    dataLayer?: unknown[];
    bmslAnalytics?: { setConsent: (granted: boolean) => void };
  }
}

// gtag.js reads `arguments` objects (not arrays) from the dataLayer.
function gtagPush() {
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer?.push(arguments);
}

/**
 * Rendered by the layout ONLY when published SiteSettings enable analytics with a valid GA4 id. It does nothing
 * (no script, no event) until analytics consent is granted through `window.bmslAnalytics.setConsent(true)` or a
 * `bmsl:analytics-consent` CustomEvent with `detail: true`. The consent banner/cookie policy is an OWNER-DECISION
 * and is not built here; contact-form consent is NOT analytics consent.
 */
export function Analytics({ ga4Id }: { ga4Id: string }) {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  const client = useRef<ReturnType<typeof createAnalytics> | null>(null);

  useEffect(() => {
    pathRef.current = pathname;
    client.current?.pageView(pathname);
  }, [pathname]);

  useEffect(() => {
    const origin = window.location.origin;
    const analytics = createAnalytics({
      ga4Id,
      origin,
      transport: (...args) => {
        window.dataLayer = window.dataLayer ?? [];
        Reflect.apply(gtagPush, null, args);
      },
      loadScript: (id) => {
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
        document.head.appendChild(script);
      },
      setDisabled: (id, disabled) => {
        (window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = disabled;
      },
    });
    client.current = analytics;
    // Disabled until explicit consent.
    (window as unknown as Record<string, unknown>)[`ga-disable-${ga4Id}`] = true;

    const setConsent = (granted: boolean) => analytics.setConsent(granted === true, pathRef.current);
    window.bmslAnalytics = { setConsent };

    const onConsent = (e: Event) => setConsent((e as CustomEvent).detail === true);
    const onAnalytics = (e: Event) => {
      const detail = (e as CustomEvent).detail as { name?: unknown; params?: unknown } | undefined;
      if (detail && isAnalyticsEvent(detail.name)) analytics.track(detail.name, detail.params, pathRef.current);
    };
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-analytics-event]');
      if (!el) return;
      const name = el.getAttribute('data-analytics-event');
      if (name !== 'phone_click' && name !== 'zalo_click' && name !== 'document_download') return;
      analytics.track(
        name,
        {
          link_location: el.getAttribute('data-analytics-location') ?? undefined,
          document_id: el.getAttribute('data-analytics-document-id') ?? undefined,
        },
        pathRef.current,
      );
    };

    window.addEventListener(ANALYTICS_CONSENT_EVENT, onConsent);
    window.addEventListener(ANALYTICS_BROWSER_EVENT, onAnalytics);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_EVENT, onConsent);
      window.removeEventListener(ANALYTICS_BROWSER_EVENT, onAnalytics);
      document.removeEventListener('click', onClick);
      analytics.setConsent(false);
      delete window.bmslAnalytics;
    };
  }, [ga4Id]);

  return null;
}
