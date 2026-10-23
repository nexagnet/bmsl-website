import type { SectionBackground } from './backgrounds';
import { safeLinkHref, text, toSectionBackground } from './public-content';

// Published SiteFooter only. Intro text and extra links are public only when ticked "confirmed" by BMSL; contact
// details come from SiteSettings (itself empty until BMSL confirms), so nothing here is invented.

export type SiteFooterView = {
  intro?: string;
  links: { label: string; href: string }[];
  copyright?: string;
  background: SectionBackground;
};

type Doc = Record<string, unknown>;
const asDoc = (v: unknown): Doc => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Doc) : {});

export function toSiteFooter(d: unknown): SiteFooterView {
  const doc = asDoc(d);
  if (doc._status !== 'published') return { links: [], background: toSectionBackground(undefined) };
  const intro = asDoc(doc.intro);
  const links = (Array.isArray(doc.links) ? doc.links : []).flatMap((l) => {
    const r = asDoc(l);
    const label = text(r.label);
    const href = safeLinkHref(r.href);
    return r.confirmed === true && label && href ? [{ label, href }] : [];
  });
  return {
    intro: intro.confirmed === true ? text(intro.text) : undefined,
    links,
    copyright: text(doc.copyright),
    background: toSectionBackground(doc.background),
  };
}

/** Published SiteCta only: the shared CTA band background (plain navy unless a published setting says otherwise). */
export function toSiteCtaBackground(d: unknown): SectionBackground {
  const doc = asDoc(d);
  return doc._status === 'published' ? toSectionBackground(doc.background) : toSectionBackground(undefined);
}
