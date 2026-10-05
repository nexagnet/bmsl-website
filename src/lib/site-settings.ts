// Published SiteSettings -> public view model. Drafts, malformed values and anything unconfirmed are dropped:
// nothing here is ever defaulted or invented (contact data is UNCONFIRMED until BMSL provides it).

type Doc = Record<string, unknown>;
const isDoc = (v: unknown): v is Doc => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined);

const GA4_ID = /^G-[A-Z0-9]{4,12}$/;
// Search Console HTML-tag token: URL-safe characters only, so it can never break out of the meta attribute.
const VERIFICATION = /^[A-Za-z0-9_-]{20,100}$/;
const HOTLINE = /^\+?[0-9][0-9 .()-]{6,18}[0-9]$/;
const ZALO = /^0\d{8,10}$/;

export const isValidGa4Id = (v: unknown): v is string => typeof v === 'string' && GA4_ID.test(v);
export const isValidVerificationToken = (v: unknown): v is string => typeof v === 'string' && VERIFICATION.test(v);

export type PublicSiteSettings = {
  /** GA4 measurement id, present only when the explicit enable switch is on AND the id is valid. */
  ga4Id?: string;
  searchConsoleVerification?: string;
  hotline?: { display: string; href: string };
  zalo?: { display: string; href: string };
};

/** Null/undefined/draft input yields an empty object, so analytics and contact links stay off. */
export function toPublicSiteSettings(doc: unknown): PublicSiteSettings {
  if (!isDoc(doc) || doc._status !== 'published') return {};
  const contact = isDoc(doc.contact) ? doc.contact : {};
  const id = str(doc.ga4Id);
  const hotline = str(contact.hotline);
  const zalo = str(contact.zalo)?.replace(/[\s.]/g, '');
  const verification = str(doc.searchConsoleVerification);
  return {
    ...(doc.analyticsEnabled === true && isValidGa4Id(id) ? { ga4Id: id } : {}),
    ...(isValidVerificationToken(verification) ? { searchConsoleVerification: verification } : {}),
    ...(hotline && HOTLINE.test(hotline)
      ? { hotline: { display: hotline, href: `tel:${hotline.replace(/[^0-9+]/g, '')}` } }
      : {}),
    ...(zalo && ZALO.test(zalo) ? { zalo: { display: zalo, href: `https://zalo.me/${zalo}` } } : {}),
  };
}
