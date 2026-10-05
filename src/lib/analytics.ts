import { parseGa4Id } from './site-settings';

// Privacy-first GA4 wiring. Nothing here touches the network itself: the caller injects the gtag function and a
// script loader, so every behaviour is provable with a mock transport. Collection is OFF unless
//   1. a published SiteSettings explicitly enabled analytics AND holds a valid GA4 id, AND
//   2. the visitor's analytics consent was granted through setConsent(true) (contact-form consent is NOT analytics consent).
// Withdrawing consent (setConsent(false)) stops every later command. Cookie/consent policy is OWNER-DECISION:
// this module is the integration point for whatever consent mechanism BMSL approves; it assumes no policy.

export const ANALYTICS_EVENTS = ['phone_click', 'zalo_click', 'form_submit', 'document_download'] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

/** Per-event allowlist of parameters and the exact value shape each may carry. Nothing else is ever sent. */
const PARAM_RULES: Record<AnalyticsEventName, Record<string, RegExp>> = {
  phone_click: { link_location: /^(header|footer|contact)$/ },
  zalo_click: { link_location: /^(header|footer|contact)$/ },
  form_submit: { request_type: /^(khao-sat|bao-gia|khac)$/ },
  document_download: { document_id: /^[0-9]{1,12}$/ },
};

export const isAnalyticsEvent = (name: unknown): name is AnalyticsEventName =>
  typeof name === 'string' && (ANALYTICS_EVENTS as readonly string[]).includes(name);

export function sanitizeEventParams(name: AnalyticsEventName, params: Record<string, unknown> = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, rule] of Object.entries(PARAM_RULES[name])) {
    const value = params[key];
    if (typeof value === 'string' && rule.test(value)) out[key] = value;
  }
  return out;
}

/** Reads a click target's data-* attributes (dataset names are camelCase) into an event; undefined if not trackable. */
export function eventFromDataset(
  dataset: Record<string, string | undefined>,
): { name: AnalyticsEventName; params: Record<string, string> } | undefined {
  const name = dataset.analyticsEvent;
  if (!isAnalyticsEvent(name)) return undefined;
  return {
    name,
    params: sanitizeEventParams(name, {
      link_location: dataset.analyticsLocation,
      request_type: dataset.analyticsRequestType,
      document_id: dataset.analyticsDocumentId,
    }),
  };
}

export type Gtag = (...args: unknown[]) => void;
export type AnalyticsDeps = {
  gtag: Gtag;
  loadScript: (src: string) => void;
  /** Sets/clears the documented `window['ga-disable-<ID>']` kill switch. */
  setDisabled: (ga4Id: string, disabled: boolean) => void;
  /** Only the origin is ever used; query strings, hashes and referrers are never read. */
  siteOrigin: () => string;
  currentPath: () => string;
};

/**
 * Privacy-safe page identifiers. GA4 would otherwise read the full URL (query/UTM/hash) and document.referrer
 * on its own, so both are set explicitly on config and on every event: path only, referrer reduced to our origin.
 */
export function safePageParams(origin: string, path: string): { page_location: string; page_referrer: string } {
  const pathname = path.split(/[?#]/, 1)[0] ?? '/';
  const safePath = pathname.startsWith('/') && !pathname.startsWith('//') ? pathname : '/';
  return { page_location: `${origin}${safePath}`, page_referrer: `${origin}/` };
}

const DENIED = {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
} as const;

export type AnalyticsConfig = { enabled: boolean; ga4Id?: string };

export function createAnalytics(config: AnalyticsConfig, deps: AnalyticsDeps) {
  const id = config.enabled ? parseGa4Id(config.ga4Id) : undefined;
  let started = false;
  let granted = false;

  const pageParams = () => safePageParams(deps.siteOrigin(), deps.currentPath());

  const start = (ga4Id: string) => {
    started = true;
    deps.setDisabled(ga4Id, false);
    deps.gtag('consent', 'default', DENIED);
    deps.loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`);
    deps.gtag('js', new Date());
    deps.gtag('consent', 'update', { analytics_storage: 'granted' });
    deps.gtag('config', ga4Id, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      ...pageParams(),
    });
  };

  return {
    /** True only while collection is possible: enabled + valid id + consent currently granted. */
    isActive: () => !!id && granted,
    setConsent(value: boolean) {
      if (!id) return;
      if (value === granted) return;
      granted = value;
      if (value) {
        if (started) {
          deps.setDisabled(id, false);
          deps.gtag('consent', 'update', { analytics_storage: 'granted' });
        } else start(id);
        deps.gtag('event', 'page_view', pageParams());
      } else {
        deps.gtag('consent', 'update', { analytics_storage: 'denied' });
        deps.setDisabled(id, true);
      }
    },
    trackPageView() {
      if (!id || !granted) return;
      deps.gtag('event', 'page_view', pageParams());
    },
    trackEvent(name: unknown, params?: Record<string, unknown>) {
      if (!id || !granted || !isAnalyticsEvent(name)) return;
      deps.gtag('event', name, { ...sanitizeEventParams(name, params), ...pageParams() });
    },
  };
}

export type AnalyticsController = ReturnType<typeof createAnalytics>;
