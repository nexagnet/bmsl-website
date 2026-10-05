import type { CollectionConfig, Field, GlobalConfig } from 'payload';
import { adminOnly, publishedOrStaff, staffOnly } from '../access';
import { isPublicSlug } from '../lib/seo';

// Blueprint `status` (draft|published) is Payload's `_status` via versions.drafts.
export const drafts = { drafts: true } as const;

export const seoField: Field = {
  name: 'seo',
  type: 'group',
  fields: [
    { name: 'title', type: 'text' },
    { name: 'metaDescription', type: 'textarea' },
    { name: 'ogImage', type: 'relationship', relationTo: 'media-assets' },
    { name: 'noindex', type: 'checkbox', defaultValue: false },
  ],
};

// A slug becomes a URL path segment (canonical, sitemap, JSON-LD): only lowercase ASCII words joined by hyphens may
// be saved, so an unsafe value (path traversal, scheme, whitespace, markup) can never be published.
export const slugField: Field = {
  name: 'slug',
  type: 'text',
  required: true,
  unique: true,
  index: true,
  validate: (value: unknown) =>
    isPublicSlug(value) || 'Slug chỉ gồm chữ thường a-z, số và dấu gạch ngang đơn (tối đa 120 ký tự).',
};

/** EDITOR-managed content: staff write, public reads published only. */
export const editorContentAccess: CollectionConfig['access'] = {
  read: publishedOrStaff,
  create: staffOnly,
  update: staffOnly,
  delete: staffOnly,
};

/**
 * Provisional fail-closed default (not a BMSL business decision): the blueprint does not grant
 * EDITOR these entities, so only ADMIN may write them. Public still reads published documents.
 */
export const adminContentAccess: CollectionConfig['access'] = {
  read: publishedOrStaff,
  create: adminOnly,
  update: adminOnly,
  delete: adminOnly,
};

export const adminSingletonAccess: GlobalConfig['access'] = {
  read: publishedOrStaff,
  update: adminOnly,
};
