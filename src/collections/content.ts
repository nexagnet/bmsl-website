import { ValidationError, type CollectionConfig } from 'payload';
import { isStaff } from '../access';
import { mergeForPublishCheck, publishGateProblem } from '../lib/publish-gate';
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
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'order', '_status', 'updatedAt'],
    description:
      'Đúng 4 lĩnh vực dịch vụ đã xác nhận. Không thêm giấy phép/cam kết/số liệu khi BMSL chưa duyệt.',
  },
  defaultSort: 'order',
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
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'order', '_status', 'updatedAt'],
    description:
      'Đúng 5 chuyên mục bài viết. Tên chuyên mục CHƯA được xác nhận: chỉ nhập khi BMSL cung cấp.',
  },
  defaultSort: 'order',
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
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'sourceStatus', '_status', 'updatedAt'],
    description:
      'Hồ sơ dự án. Thông tin lấy từ nguồn cũ là UNCONFIRMED cho tới khi BMSL/chủ đầu tư xác nhận; giữ ở trạng thái nháp.',
  },
  access: editorContentAccess,
  versions: drafts,
  hooks: {
    // Customer facts stay draft until sourceStatus is CONFIRMED (incl. the 17 imported legacy profiles).
    beforeValidate: [
      ({ data, originalDoc, operation }) => {
        if (operation !== 'create' && operation !== 'update') return data;
        const problem = publishGateProblem(mergeForPublishCheck(originalDoc, data));
        if (problem) throw new ValidationError({ errors: [{ message: problem, path: 'sourceStatus' }] });
        return data;
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField,
    { name: 'summary', type: 'textarea' },
    {
      name: 'address',
      type: 'text',
      admin: { description: 'UNCONFIRMED cho tới khi nguồn xác nhận.' },
    },
    {
      name: 'scale',
      type: 'text',
      admin: { description: 'UNCONFIRMED: số toà/căn chỉ nhập khi có nguồn.' },
    },
    {
      name: 'operatingSince',
      type: 'text',
      admin: { description: 'UNCONFIRMED cho tới khi nguồn xác nhận.' },
    },
    { name: 'services', type: 'relationship', relationTo: 'service-areas', hasMany: true },
    { name: 'images', type: 'relationship', relationTo: 'media-assets', hasMany: true },
    {
      name: 'bqtFeedback',
      type: 'group',
      fields: [
        {
          name: 'text',
          type: 'textarea',
          admin: {
            description:
              'Phản hồi của BQT (UNCONFIRMED). Chỉ hiển thị công khai khi tích "Đã được nguồn duyệt" bên dưới.',
          },
          access: {
            // The public sees the feedback text only once the source approved it.
            read: ({ req, siblingData }) =>
              isStaff(req.user) || siblingData?.approvedBySource === true,
          },
        },
        {
          name: 'approvedBySource',
          type: 'checkbox',
          defaultValue: false,
          label: 'Đã được nguồn duyệt',
          admin: {
            description: 'Chỉ tích khi BQT/chủ đầu tư đã xác nhận cho phép công bố phản hồi này.',
          },
        },
      ],
    },
    {
      name: 'legacyUrls',
      type: 'array',
      // Migration provenance is internal: never part of any anonymous REST response.
      access: { read: ({ req }) => isStaff(req.user) },
      fields: [{ name: 'url', type: 'text', required: true }],
    },
    {
      name: 'sourceStatus',
      type: 'select',
      required: true,
      defaultValue: 'LEGACY-SOURCE',
      options: ['LEGACY-SOURCE', 'CONFIRMED'],
      admin: {
        description:
          'LEGACY-SOURCE = lấy từ website cũ, chưa xác nhận. Chỉ chọn CONFIRMED khi BMSL đã duyệt.',
      },
    },
    seoField,
  ],
};

export const Articles: CollectionConfig = {
  slug: 'articles',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'publishedAt', '_status', 'updatedAt'],
    description: 'Bài viết. Số liệu, tên riêng và cam kết cần nguồn được duyệt trước khi xuất bản.',
  },
  defaultSort: '-publishedAt',
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
    { name: 'legacyUrl', type: 'text', access: { read: ({ req }) => isStaff(req.user) } },
    seoField,
  ],
};

export const JobPostings: CollectionConfig = {
  slug: 'job-postings',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'deadline', '_status', 'updatedAt'],
    description:
      'Tin tuyển dụng. Lương, quyền lợi và hạn nộp là UNCONFIRMED cho tới khi BMSL xác nhận.',
  },
  access: editorContentAccess,
  versions: drafts,
  fields: [
    { name: 'title', type: 'text', required: true },
    slugField,
    { name: 'description', type: 'richText' },
    { name: 'requirements', type: 'richText' },
    { name: 'benefits', type: 'richText' },
    {
      name: 'salary',
      type: 'text',
      admin: { description: 'UNCONFIRMED: không nhập mức lương khi chưa có xác nhận của BMSL.' },
    },
    { name: 'deadline', type: 'date' },
    { name: 'applyInstruction', type: 'textarea', required: true },
    seoField,
  ],
};

export const Documents: CollectionConfig = {
  slug: 'documents',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', '_status', 'updatedAt'],
    description: 'Tài liệu tải về. Tệp là media: chỉ hiển thị công khai khi rightsStatus=APPROVED.',
  },
  access: editorContentAccess,
  versions: drafts,
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'file', type: 'relationship', relationTo: 'media-assets', required: true },
    { name: 'description', type: 'textarea' },
    { name: 'category', type: 'text' },
  ],
};
