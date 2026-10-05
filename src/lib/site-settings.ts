import { parseSearchConsoleToken, safeHttpUrl } from './seo';

// Public view of the SiteSettings singleton. Only a PUBLISHED document is read; every value is validated and
// anything invalid is dropped (never repaired or guessed). Contact details stay UNCONFIRMED until BMSL publishes them.

type Doc = Record<string, unknown>;
const isDoc = (v: unknown): v is Doc => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined);

export const GA4_ID = /^G-[A-Z0-9]{6,12}$/;

export const parseGa4Id = (v: unknown): string | undefined => {
  const id = str(v)?.toUpperCase();
  return id && GA4_ID.test(id) ? id : undefined;
};

/** Hotline: digits with optional leading + and common separators; the dial string keeps digits and a leading +. */
export function parseHotline(v: unknown): { label: string; href: string } | undefined {
  const label = str(v);
  if (!label || !/^\+?[0-9][0-9 .()-]{6,18}$/.test(label)) return undefined;
  const digits = label.replace(/[^\d]/g, '');
  if (digits.length < 8 || digits.length > 15) return undefined;
  return { label, href: `tel:${label.startsWith('+') ? '+' : ''}${digits}` };
}

/** Zalo: a phone-number style id only; the link is always https://zalo.me/<digits>, never a free-form URL. */
export function parseZalo(v: unknown): { label: string; href: string } | undefined {
  const label = str(v);
  if (!label || !/^\+?[0-9][0-9 .()-]{6,18}$/.test(label)) return undefined;
  const digits = label.replace(/[^\d]/g, '');
  if (digits.length < 8 || digits.length > 15) return undefined;
  return { label, href: `https://zalo.me/${digits}` };
}

export type SiteSettingsView = {
  hotline?: { label: string; href: string };
  zalo?: { label: string; href: string };
  socialUrls: string[];
  ga4Id?: string;
  /** True only when an admin explicitly switched analytics on AND the GA4 id is valid. Consent is still required. */
  analyticsEnabled: boolean;
  searchConsoleVerification?: string;
};

export const EMPTY_SITE_SETTINGS: SiteSettingsView = { socialUrls: [], analyticsEnabled: false };

export function toSiteSettings(d: unknown): SiteSettingsView {
  if (!isDoc(d) || d._status !== 'published') return EMPTY_SITE_SETTINGS;
  const contact = isDoc(d.contact) ? d.contact : {};
  const ga4Id = parseGa4Id(d.ga4Id);
  return {
    hotline: parseHotline(contact.hotline),
    zalo: parseZalo(contact.zalo),
    socialUrls: (Array.isArray(d.socialLinks) ? d.socialLinks : [])
      .map((l) => (isDoc(l) ? safeHttpUrl(l.url) : undefined))
      .filter((u): u is string => !!u && u.startsWith('https://')),
    ga4Id,
    analyticsEnabled: d.analyticsEnabled === true && !!ga4Id,
    searchConsoleVerification: parseSearchConsoleToken(d.searchConsoleVerification),
  };
}
