import type { CollectionConfig } from 'payload';
import {
  adminContentAccess,
  drafts,
  editorContentAccess,
  seoField,
  slugField,
} from './shared';

// Blueprint 06 §3. "Max N" figures are acceptance limits of the initial handover, not CMS ceilings,
// so no maxRows/count caps are enforced here (ArticleCategory/ServiceArea counts are seed/acceptance data).

export const ServiceAreas: CollectionConfig = {
  slug: 'service-areas',
  admin: { useAsTitle: 'name' },
  access: adminContentAccess,
  versions: drafts,
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField,
    { name: 'summary', type: 'textarea', required: true },
    { name: 'body', type: 'richText' },
    { name: 'order', type: 'number', required: true, defaultValue: 0 },
    seoField,
  ],
};

export const ArticleCategories: CollectionConfig = {
  slug: 'article-categories',
  admin: { useAsTitle: 'name' },
  access: adminContentAccess,
  versions: drafts,
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField,
    { name: 'order', type: 'number', required: true, defaultValue: 0 },
  ],
};

export const Projects: CollectionConfig = {
  slug: 'projects',
  admin: { useAsTitle: 'name' },
  access: editorContentAccess,
  versions: drafts,
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField,
    { name: 'summary', type: 'textarea' },
    { name: 'address', type: 'text' },
    { name: 'scale', type: 'text' },
    { name: 'operatingSince', type: 'text' },
    { name: 'services', type: 'relationship', relationTo: 'service-areas', hasMany: true },
    { name: 'images', type: 'relationship', relationTo: 'media-assets', hasMany: true },
    {
      name: 'bqtFeedback',
      type: 'group',
      fields: [
        { name: 'text', type: 'textarea' },
        { name: 'approvedBySource', type: 'checkbox', defaultValue: false },
      ],
    },
    { name: 'legacyUrls', type: 'array', fields: [{ name: 'url', type: 'text', required: true }] },
    {
      name: 'sourceStatus',
      type: 'select',
      required: true,
      defaultValue: 'LEGACY-SOURCE',
      options: ['LEGACY-SOURCE', 'CONFIRMED'],
    },
    seoField,
  ],
};

export const Articles: CollectionConfig = {
  slug: 'articles',
  admin: { useAsTitle: 'title' },
  access: editorContentAccess,
  versions: drafts,
  fields: [
    { name: 'title', type: 'text', required: true },
    slugField,
    { name: 'excerpt', type: 'textarea' },
    { name: 'body', type: 'richText' },
    { name: 'category', type: 'relationship', relationTo: 'article-categories' },
    { name: 'cover', type: 'relationship', relationTo: 'media-assets' },
    { name: 'publishedAt', type: 'date' },
    { name: 'legacyUrl', type: 'text' },
    seoField,
  ],
};

export const JobPostings: CollectionConfig = {
  slug: 'job-postings',
  admin: { useAsTitle: 'title' },
  access: editorContentAccess,
  versions: drafts,
  fields: [
    { name: 'title', type: 'text', required: true },
    slugField,
    { name: 'description', type: 'richText' },
    { name: 'requirements', type: 'richText' },
    { name: 'benefits', type: 'richText' },
    { name: 'salary', type: 'text' },
    { name: 'deadline', type: 'date' },
    { name: 'applyInstruction', type: 'textarea', required: true },
    seoField,
  ],
};

export const Documents: CollectionConfig = {
  slug: 'documents',
  admin: { useAsTitle: 'title' },
  access: editorContentAccess,
  versions: drafts,
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'file', type: 'relationship', relationTo: 'media-assets', required: true },
    { name: 'description', type: 'textarea' },
    { name: 'category', type: 'text' },
  ],
};
