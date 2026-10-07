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

// Office map: shown only when BMSL ticks the approval box AND supplies coordinates inside Vietnam (guards swapped or
// mistyped values). The embed URL is built here from numbers only; no editor-supplied URL or HTML is ever rendered.
const VN_LAT = [8, 24] as const;
const VN_LON = [102, 110] as const;
const BBOX_DELTA = 0.004;

const coordinate = (v: unknown, [min, max]: readonly [number, number]): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined;

export type OfficeMap = { embedSrc: string; linkHref: string };

export const buildOfficeMap = (lat: number, lon: number): OfficeMap => {
  const f = (n: number) => n.toFixed(6);
  const bbox = [lon - BBOX_DELTA, lat - BBOX_DELTA, lon + BBOX_DELTA, lat + BBOX_DELTA].map(f).join(',');
  return {
    embedSrc: `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${f(lat)},${f(lon)}`,
    linkHref: `https://www.openstreetmap.org/?mlat=${f(lat)}&mlon=${f(lon)}#map=17/${f(lat)}/${f(lon)}`,
  };
};

export type SiteSettingsView = {
  /** Present only when analytics is explicitly enabled AND the GA4 id is valid. Consent is still required at runtime. */
  analytics?: { measurementId: string };
  hotline?: { label: string; href: string };
  zalo?: { href: string };
  address?: string;
  map?: OfficeMap;
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
  const address = text(contact.address);
  const lat = coordinate(contact.mapLatitude, VN_LAT);
  const lon = coordinate(contact.mapLongitude, VN_LON);
  const map = contact.mapApproved === true && lat !== undefined && lon !== undefined ? buildOfficeMap(lat, lon) : undefined;
  return {
    ...(measurementId ? { analytics: { measurementId } } : {}),
    ...(hotlineDigits && hotlineLabel ? { hotline: { label: hotlineLabel, href: `tel:${hotlineDigits}` } } : {}),
    ...(address ? { address } : {}),
    ...(map ? { map } : {}),
    ...(zaloDigits ? { zalo: { href: `https://zalo.me/${zaloDigits.replace(/^\+/, '')}` } } : {}),
    ...(parseVerificationToken(doc.searchConsoleVerification)
      ? { searchConsoleVerification: parseVerificationToken(doc.searchConsoleVerification) }
      : {}),
  };
}
