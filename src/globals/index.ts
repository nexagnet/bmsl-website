import type { GlobalConfig } from 'payload';
import { adminSingletonAccess, drafts, seoField } from '../collections/shared';

// Singletons. Block structure follows wireframe 05 §3 in later work; W1B keeps a rich-text body + SEO.
// Provisional fail-closed default: only ADMIN writes these (not a BMSL business decision).
const page = (slug: string): GlobalConfig => ({
  slug,
  access: adminSingletonAccess,
  versions: drafts,
  fields: [{ name: 'title', type: 'text' }, { name: 'body', type: 'richText' }, seoField],
});

export const HomePage = page('home-page');
export const AboutPage = page('about-page');
export const ProcessPage = page('process-page');
export const ContactPage = page('contact-page');

// Public contact details are UNCONFIRMED (CONTACT_DETAILS_REQUIRES_BMSL_CONFIRMATION):
// no defaults are provided and nothing is published until BMSL confirms.
export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  access: adminSingletonAccess,
  versions: drafts,
  fields: [
    {
      name: 'contact',
      type: 'group',
      fields: [
        { name: 'address', type: 'text' },
        { name: 'email', type: 'email' },
        { name: 'hotline', type: 'text' },
        { name: 'zalo', type: 'text' },
      ],
    },
    {
      name: 'socialLinks',
      type: 'array',
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'url', type: 'text', required: true },
      ],
    },
    { name: 'ga4Id', type: 'text' },
  ],
};
