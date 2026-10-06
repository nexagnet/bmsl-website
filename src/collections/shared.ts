import type { CollectionConfig, Field, GlobalConfig } from 'payload';
import { adminOnly, publishedOrStaff, staffOnly } from '../access';
import { isPublicSlug } from '../lib/seo';

// Blueprint `status` (draft|published) is Payload's `_status` via versions.drafts.
export const drafts = { drafts: true } as const;

export const seoField: Field = {
  name: 'seo',
  type: 'group',
  label: 'SEO',
  fields: [
    { name: 'title', type: 'text', label: 'Tiêu đề SEO' },
    { name: 'metaDescription', type: 'textarea', label: 'Mô tả SEO' },
    { name: 'ogImage', type: 'relationship', relationTo: 'media-assets', label: 'Ảnh chia sẻ' },
    {
      name: 'noindex',
      type: 'checkbox',
      defaultValue: false,
      label: 'Không lập chỉ mục',
      admin: { description: 'Tích để yêu cầu công cụ tìm kiếm không lập chỉ mục trang này.' },
    },
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
  label: 'Đường dẫn (slug)',
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
