import type { AnalyticsController } from './analytics';

declare global {
  interface Window {
    /** Present only when analytics is enabled in published SiteSettings. Consent UIs call setConsent(). */
    bmslAnalytics?: Pick<AnalyticsController, 'setConsent' | 'trackEvent' | 'isActive'>;
  }
}

/** Event name dispatched on `window` by a consent mechanism: `new CustomEvent('bmsl:analytics-consent', { detail: { granted } })`. */
export const CONSENT_EVENT = 'bmsl:analytics-consent';

/** No-op when analytics is disabled (the controller is not even installed) or consent is absent. */
export const trackEvent = (name: string, params?: Record<string, unknown>): void => {
  if (typeof window !== 'undefined') window.bmslAnalytics?.trackEvent(name, params);
};
