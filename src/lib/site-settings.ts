import { text } from './public-content';

// Published SiteSettings only. Contact facts are UNCONFIRMED until BMSL fills them in the CMS: nothing here
// has a default, and a value that does not validate is hidden rather than repaired or invented.

const GA4_ID = /^G-[A-Z0-9]{6,12}$/;
const VN_PHONE = /^(?:\+?84|0)\d{8,10}$/;
// Search Console HTML-tag tokens are URL-safe base64-like strings.
const VERIFICATION = /^[A-Za-z0-9_-]{20,100}$/;

export const parseGa4Id = (v: unknown): string | undefined => {
  const s = text(v);
  return s && GA4_ID.test(s) ? s : undefined;
};

export const parseVerificationToken = (v: unknown): string | undefined => {
  const s = text(v);
  return s && VERIFICATION.test(s) ? s : undefined;
};

const digitsOfPhone = (v: unknown): string | undefined => {
  const s = text(v);
  const digits = s?.replace(/[\s.\-()]/g, '');
  return digits && VN_PHONE.test(digits) ? digits : undefined;
};

export type SiteSettingsView = {
  /** Present only when analytics is explicitly enabled AND the GA4 id is valid. Consent is still required at runtime. */
  analytics?: { measurementId: string };
  hotline?: { label: string; href: string };
  zalo?: { href: string };
  searchConsoleVerification?: string;
};

type Doc = Record<string, unknown>;
const asDoc = (v: unknown): Doc => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Doc) : {});

export function toSiteSettings(d: unknown): SiteSettingsView {
  const doc = asDoc(d);
  if (doc._status !== 'published') return {};
  const contact = asDoc(doc.contact);
  const measurementId = doc.analyticsEnabled === true ? parseGa4Id(doc.ga4Id) : undefined;
  const hotlineDigits = digitsOfPhone(contact.hotline);
  const zaloDigits = digitsOfPhone(contact.zalo);
  const hotlineLabel = text(contact.hotline);
  return {
    ...(measurementId ? { analytics: { measurementId } } : {}),
    ...(hotlineDigits && hotlineLabel ? { hotline: { label: hotlineLabel, href: `tel:${hotlineDigits}` } } : {}),
    ...(zaloDigits ? { zalo: { href: `https://zalo.me/${zaloDigits.replace(/^\+/, '')}` } } : {}),
    ...(parseVerificationToken(doc.searchConsoleVerification)
      ? { searchConsoleVerification: parseVerificationToken(doc.searchConsoleVerification) }
      : {}),
  };
}
