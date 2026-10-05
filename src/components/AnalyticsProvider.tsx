'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { type AnalyticsController, createAnalytics, eventFromDataset } from '../lib/analytics';
import { CONSENT_EVENT } from '../lib/analytics-client';

declare global {
  interface Window {
    dataLayer?: unknown[];
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}

/**
 * Rendered only when published SiteSettings enabled analytics with a valid GA4 id (see layout), so by default this
 * component does not exist and no script, listener or global is installed. Even when rendered it sends nothing
 * until a consent mechanism grants analytics consent: `window.bmslAnalytics.setConsent(true)` or a
 * `bmsl:analytics-consent` CustomEvent with `{ detail: { granted: true } }`. The consent UI/policy is an OWNER-DECISION.
 */
export function AnalyticsProvider({ ga4Id }: { ga4Id: string }) {
  const controller = useRef<AnalyticsController | null>(null);
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    const analytics = createAnalytics(
      { enabled: true, ga4Id },
      {
        // gtag.js requires the `arguments` object itself (a plain array is not interpreted as a command).
        gtag: function () {
          window.dataLayer = window.dataLayer ?? [];
          // eslint-disable-next-line prefer-rest-params
          window.dataLayer.push(arguments);
        },
        loadScript: (src) => {
          const script = document.createElement('script');
          script.async = true;
          script.src = src;
          document.head.appendChild(script);
        },
        setDisabled: (id, disabled) => {
          window[`ga-disable-${id}`] = disabled;
        },
        siteOrigin: () => window.location.origin,
        currentPath: () => window.location.pathname,
      },
    );
    controller.current = analytics;
    window.bmslAnalytics = analytics;

    const onConsent = (event: Event) => analytics.setConsent((event as CustomEvent<{ granted?: unknown }>).detail?.granted === true);
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-analytics-event]') : null;
      const parsed = target ? eventFromDataset({ ...target.dataset }) : undefined;
      if (parsed) analytics.trackEvent(parsed.name, parsed.params);
    };
    window.addEventListener(CONSENT_EVENT, onConsent);
    document.addEventListener('click', onClick);
    return () => {
      analytics.setConsent(false);
      window.removeEventListener(CONSENT_EVENT, onConsent);
      document.removeEventListener('click', onClick);
      delete window.bmslAnalytics;
      controller.current = null;
    };
  }, [ga4Id]);

  // Client-side navigations: one page_view per route change (the initial one is sent when consent is granted).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    controller.current?.trackPageView();
  }, [pathname]);

  return null;
}
