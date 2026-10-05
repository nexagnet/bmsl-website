// Opt-in, privacy-first analytics core (docs/blueprint/06 §7). Pure and transport-injected so every rule is
// provable without a browser or a GA4 account. Nothing is loaded or sent until consent is granted; the cookie /
// consent policy itself is OWNER-DECISION, so consent is an input (setConsent), never an assumed default.

export const ANALYTICS_EVENTS = ['phone_click', 'zalo_click', 'form_submit', 'document_download'] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export const CONSENT_EVENT = 'bmsl:analytics-consent';
export const TRACK_EVENT = 'bmsl:analytics-event';

// Mirrors REQUEST_TYPES (collections/ContactLeads); duplicated so this client-side module never imports the CMS
// config. A unit test keeps the two lists identical.
export const ANALYTICS_REQUEST_TYPES = ['khao-sat', 'bao-gia', 'khac'] as const;

/** Only these parameters may leave the browser, each with a strict value shape. Never lead data or URLs. */
const PARAM_RULES: Record<string, (v: string) => boolean> = {
  link_location: (v) => /^[a-z][a-z_-]{0,39}$/.test(v),
  request_type: (v) => (ANALYTICS_REQUEST_TYPES as readonly string[]).includes(v),
  document_id: (v) => /^[A-Za-z0-9_-]{1,40}$/.test(v),
};

export type EventParams = Record<string, string>;

export const isAnalyticsEvent = (name: unknown): name is AnalyticsEventName =>
  typeof name === 'string' && (ANALYTICS_EVENTS as readonly string[]).includes(name);

export function allowlistParams(input: unknown): EventParams {
  const out: EventParams = {};
  if (typeof input !== 'object' || input === null) return out;
  for (const [key, rule] of Object.entries(PARAM_RULES)) {
    const value = (input as Record<string, unknown>)[key];
    if (typeof value === 'string' && rule(value)) out[key] = value;
  }
  return out;
}

const SAFE_PATH = /^\/(?:[A-Za-z0-9\-._~][A-Za-z0-9\-._~/]*)?$/;

/** origin + path only: query strings, UTM values and fragments (possible PII) never reach GA4. */
export function sanitizePageLocation(origin: string, pathname: string): string {
  const path = SAFE_PATH.test(pathname) ? pathname : '/';
  return `${origin}${path}`;
}

export type AnalyticsTransport = {
  /** Loads the external script. Called at most once, and only after consent. */
  load(measurementId: string): void;
  config(measurementId: string, params: Record<string, string | boolean>): void;
  event(name: string, params: Record<string, string>): void;
  /** Called on consent withdrawal so the external library stops collecting. */
  disable(measurementId: string): void;
};

export type AnalyticsController = {
  setConsent(granted: boolean): void;
  pageView(pathname: string): void;
  track(name: unknown, params?: unknown): void;
};

export function createAnalytics(opts: {
  measurementId: string;
  origin: string;
  transport: AnalyticsTransport;
  getPathname: () => string;
}): AnalyticsController {
  const { measurementId, origin, transport } = opts;
  let consent = false;
  let started = false;

  // page_referrer is pinned to the site origin: real referrers (and their query strings) are never transmitted.
  const common = (pathname: string) => ({ page_location: sanitizePageLocation(origin, pathname), page_referrer: origin });

  const start = () => {
    if (started) return;
    started = true;
    transport.load(measurementId);
    transport.config(measurementId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      ...common(opts.getPathname()),
    });
  };

  const controller: AnalyticsController = {
    setConsent(granted) {
      if (granted === consent) return;
      consent = granted === true;
      if (consent) {
        start();
        controller.pageView(opts.getPathname());
      } else if (started) {
        transport.disable(measurementId);
      }
    },
    pageView(pathname) {
      if (!consent) return;
      const params = common(pathname);
      transport.config(measurementId, { send_page_view: false, ...params });
      transport.event('page_view', params);
    },
    track(name, params) {
      if (!consent || !isAnalyticsEvent(name)) return;
      transport.event(name, { ...allowlistParams(params), ...common(opts.getPathname()) });
    },
  };
  return controller;
}

/**
 * Decides whether a /lien-he/gui response warrants a form_submit event. Only a 200 whose body carries
 * `persisted: true` (set by the server after the durable write) qualifies: invalid input (400), honeypot
 * (200 without `persisted`), failed writes (500) and network errors never do. Only request_type is sent.
 */
export function formSubmitParams(status: number, body: unknown, requestType: unknown): EventParams | undefined {
  const persisted = typeof body === 'object' && body !== null && (body as { persisted?: unknown }).persisted === true;
  if (status !== 200 || !persisted) return undefined;
  return allowlistParams({ request_type: requestType });
}

/** Browser-side: ask the mounted provider to record an event. A no-op when analytics is not mounted. */
export function emitAnalyticsEvent(name: AnalyticsEventName, params?: EventParams): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TRACK_EVENT, { detail: { name, params } }));
  }
}
