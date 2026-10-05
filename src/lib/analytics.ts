// Opt-in, privacy-safe analytics core (pure; the transport and script loader are injected).
//
// Nothing is sent unless: a valid GA4 id from PUBLISHED SiteSettings, the explicit enable switch, and
// explicit analytics consent (separate from the contact-form consent). Withdrawal stops all later traffic.
// Only the four allowlisted events with allowlisted minimal params are emitted; every event and the page
// view carry a cleaned page_location (origin + path only) and a fixed page_referrer (the site origin).

// Client-safe: no server imports. Kept in sync with REQUEST_TYPES by analytics.test.ts.
export const ANALYTICS_REQUEST_TYPES = ['khao-sat', 'bao-gia', 'khac'] as const;

export const ANALYTICS_EVENTS = ['phone_click', 'zalo_click', 'form_submit', 'document_download'] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export const ANALYTICS_BROWSER_EVENT = 'bmsl:analytics';
export const ANALYTICS_CONSENT_EVENT = 'bmsl:analytics-consent';

export type AnalyticsParams = { link_location?: string; request_type?: string; document_id?: string };

const LOCATION = /^[a-z0-9_-]{1,40}$/;
const DOCUMENT_ID = /^\d{1,12}$/;

/** Keeps only allowlisted keys with strictly validated values; everything else (names, phones, free text, URLs) is dropped. */
export function allowlistParams(raw: unknown): AnalyticsParams {
  const src = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const out: AnalyticsParams = {};
  if (typeof src.link_location === 'string' && LOCATION.test(src.link_location)) out.link_location = src.link_location;
  if (typeof src.request_type === 'string' && (ANALYTICS_REQUEST_TYPES as readonly string[]).includes(src.request_type)) {
    out.request_type = src.request_type;
  }
  if (typeof src.document_id === 'string' && DOCUMENT_ID.test(src.document_id)) out.document_id = src.document_id;
  return out;
}

export const isAnalyticsEvent = (v: unknown): v is AnalyticsEventName =>
  (ANALYTICS_EVENTS as readonly unknown[]).includes(v);

/** origin + pathname only: query string, UTM, fragment and credentials are never transmitted. */
export function cleanPageLocation(origin: string, pathname: string): string {
  const path = pathname.split(/[?#]/)[0] ?? '/';
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

export type Transport = (...args: unknown[]) => void;

export type AnalyticsDeps = {
  ga4Id: string;
  origin: string;
  /** gtag-compatible function. Injected so tests prove traffic without a network. */
  transport: Transport;
  /** Loads the external measurement script; called at most once and only after consent. */
  loadScript: (ga4Id: string) => void;
  /** Disables/enables the library's own collection (window['ga-disable-<id>']). */
  setDisabled: (ga4Id: string, disabled: boolean) => void;
};

export function createAnalytics(deps: AnalyticsDeps) {
  let consent = false;
  let started = false;

  const base = (pathname: string) => ({
    page_location: cleanPageLocation(deps.origin, pathname),
    // The real referrer is never forwarded (it can carry query strings or PII); the site origin is sent instead.
    page_referrer: deps.origin,
  });

  return {
    get consent() {
      return consent;
    },
    setConsent(granted: boolean, pathname = '/') {
      consent = granted === true;
      if (!consent) {
        deps.setDisabled(deps.ga4Id, true);
        if (started) deps.transport('consent', 'update', { analytics_storage: 'denied' });
        return;
      }
      deps.setDisabled(deps.ga4Id, false);
      if (!started) {
        started = true;
        deps.transport('consent', 'default', {
          analytics_storage: 'granted',
          ad_storage: 'denied',
          ad_user_data: 'denied',
          ad_personalization: 'denied',
        });
        deps.loadScript(deps.ga4Id);
        deps.transport('js', new Date());
        deps.transport('config', deps.ga4Id, {
          send_page_view: false,
          allow_google_signals: false,
          allow_ad_personalization_signals: false,
          ...base(pathname),
        });
      } else {
        deps.transport('consent', 'update', { analytics_storage: 'granted' });
      }
      deps.transport('event', 'page_view', base(pathname));
    },
    pageView(pathname: string) {
      if (consent) deps.transport('event', 'page_view', base(pathname));
    },
    track(name: unknown, params: unknown, pathname = '/') {
      if (!consent || !isAnalyticsEvent(name)) return false;
      deps.transport('event', name, { ...allowlistParams(params), ...base(pathname) });
      return true;
    },
  };
}
