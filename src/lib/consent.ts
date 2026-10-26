// Cookie-consent decision storage (pure and storage-injected, so it is unit-testable without a browser).
// The decision covers analytics only; strictly necessary storage needs no consent. Nothing is granted by default.

export const CONSENT_STORAGE_KEY = 'bmsl_cookie_consent';
export const CONSENT_VERSION = 1;
/** Dispatched by the footer link to reopen the banner so the visitor can change the choice. */
export const OPEN_COOKIE_SETTINGS_EVENT = 'bmsl:open-cookie-settings';
export const COOKIE_POLICY_PATH = '/chinh-sach-cookie';
/** The choice is asked again after this long (it is a stored preference, not a permanent grant). */
export const CONSENT_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

export type ConsentDecision = { analytics: boolean; at: number };
export type ConsentStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function parseConsent(raw: string | null | undefined, now: number = Date.now()): ConsentDecision | undefined {
  if (!raw) return undefined;
  try {
    const v = JSON.parse(raw) as { v?: unknown; analytics?: unknown; at?: unknown };
    if (v.v !== CONSENT_VERSION || typeof v.analytics !== 'boolean' || typeof v.at !== 'number') return undefined;
    if (!Number.isFinite(v.at) || v.at > now + 60_000 || now - v.at > CONSENT_MAX_AGE_MS) return undefined;
    return { analytics: v.analytics, at: v.at };
  } catch {
    return undefined;
  }
}

export function readConsent(storage: ConsentStorage | undefined, now?: number): ConsentDecision | undefined {
  try {
    return parseConsent(storage?.getItem(CONSENT_STORAGE_KEY), now);
  } catch {
    return undefined;
  }
}

/** Returns false when the choice could not be persisted (private mode, blocked storage); callers still apply it for the page. */
export function writeConsent(storage: ConsentStorage | undefined, analytics: boolean, now: number = Date.now()): boolean {
  try {
    storage?.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ v: CONSENT_VERSION, analytics, at: now }));
    return storage !== undefined;
  } catch {
    return false;
  }
}

/** Names of Google Analytics cookies (`_ga`, `_ga_<id>`, `_gid`, `_gat*`) in a document.cookie string. */
export function gaCookieNames(cookieString: string): string[] {
  return cookieString
    .split(';')
    .map((part) => part.split('=')[0]?.trim() ?? '')
    .filter((name) => name === '_ga' || name === '_gid' || name.startsWith('_ga_') || name.startsWith('_gat'));
}
