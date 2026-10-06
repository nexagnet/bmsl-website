import { ValidationError, type CollectionConfig } from 'payload';
import { isStaff } from '../access';
import { jobPublishGateProblem, mergeForPublishCheck, publishGateProblem } from '../lib/publish-gate';
import {
  adminContentAccess,
  drafts,
  editorContentAccess,
  seoField,
  slugField,
} from './shared';

// Display labels only: the stored option values stay LEGACY-SOURCE / CONFIRMED.
const sourceStatusOptions = [
  { label: 'Nguồn cũ – chưa xác nhận', value: 'LEGACY-SOURCE' },
  { label: 'Đã xác nhận', value: 'CONFIRMED' },
];

// Blueprint 06 §3. "Max N" figures are acceptance limits of the initial handover, not CMS ceilings,
// so no maxRows/count caps are enforced here (ArticleCategory/ServiceArea counts are seed/acceptance data).

export const ServiceAreas: CollectionConfig = {
  slug: 'service-areas',
  labels: { singular: 'Lĩnh vực dịch vụ', plural: 'Lĩnh vực dịch vụ' },
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
    { name: 'name', type: 'text', required: true, label: 'Tên lĩnh vực' },
    slugField,
    { name: 'summary', type: 'textarea', required: true, label: 'Tóm tắt' },
    { name: 'body', type: 'richText', label: 'Nội dung' },
    { name: 'order', type: 'number', required: true, defaultValue: 0, label: 'Thứ tự hiển thị' },
    seoField,
  ],
};

export const ArticleCategories: CollectionConfig = {
  slug: 'article-categories',
  labels: { singular: 'Chuyên mục bài viết', plural: 'Chuyên mục bài viết' },
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
    { name: 'name', type: 'text', required: true, label: 'Tên chuyên mục' },
    slugField,
    { name: 'order', type: 'number', required: true, defaultValue: 0, label: 'Thứ tự hiển thị' },
  ],
};

export const Projects: CollectionConfig = {
  slug: 'projects',
  labels: { singular: 'Dự án', plural: 'Dự án' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'sourceStatus', '_status', 'updatedAt'],
    description:
      'Hồ sơ dự án. Thông tin lấy từ nguồn cũ là UNCONFIRMED cho tới khi BMSL/chủ đầu tư xác nhận; giữ ở trạng thái nháp.',
  },
  access: {
    ...editorContentAccess,
    // The public REST boundary also requires CONFIRMED, so stored unconfirmed (for example legacy) data stays hidden.
    read: ({ req }) =>
      isStaff(req.user) ? true : { _status: { equals: 'published' }, sourceStatus: { equals: 'CONFIRMED' } },
  },
  versions: drafts,
  hooks: {
    // A project can only be published with sourceStatus CONFIRMED (incl. the 17 imported legacy profiles).
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
    { name: 'name', type: 'text', required: true, label: 'Tên dự án' },
    slugField,
    { name: 'summary', type: 'textarea', label: 'Tóm tắt' },
    {
      name: 'address',
      type: 'text',
      label: 'Địa chỉ',
      admin: { description: 'UNCONFIRMED cho tới khi nguồn xác nhận.' },
    },
    {
      name: 'scale',
      type: 'text',
      label: 'Quy mô',
      admin: { description: 'UNCONFIRMED: số toà/căn chỉ nhập khi có nguồn.' },
    },
    {
      name: 'operatingSince',
      type: 'text',
      label: 'Vận hành từ',
      admin: { description: 'UNCONFIRMED cho tới khi nguồn xác nhận.' },
    },
    {
      name: 'services',
      type: 'relationship',
      relationTo: 'service-areas',
      hasMany: true,
      label: 'Lĩnh vực dịch vụ',
    },
    {
      name: 'images',
      type: 'relationship',
      relationTo: 'media-assets',
      hasMany: true,
      label: 'Hình ảnh dự án',
    },
    {
      name: 'bqtFeedback',
      type: 'group',
      label: 'Phản hồi của BQT',
      fields: [
        {
          name: 'text',
          type: 'textarea',
          label: 'Nội dung phản hồi',
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
      // Migration provenance is internal: anonymous responses carry no values (the framework may return an empty array).
      access: { read: ({ req }) => isStaff(req.user) },
      label: 'Đường dẫn cũ (website cũ)',
      labels: { singular: 'Đường dẫn', plural: 'Đường dẫn' },
      fields: [{ name: 'url', type: 'text', required: true, label: 'Đường dẫn cũ' }],
    },
    {
      name: 'sourceStatus',
      type: 'select',
      required: true,
      defaultValue: 'LEGACY-SOURCE',
      label: 'Trạng thái xác nhận nguồn',
      options: sourceStatusOptions,
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
  labels: { singular: 'Bài viết', plural: 'Bài viết' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'publishedAt', '_status', 'updatedAt'],
    description: 'Bài viết. Số liệu, tên riêng và cam kết cần nguồn được duyệt trước khi xuất bản.',
  },
  defaultSort: '-publishedAt',
  access: editorContentAccess,
  versions: drafts,
  fields: [
    { name: 'title', type: 'text', required: true, label: 'Tiêu đề bài viết' },
    slugField,
    { name: 'excerpt', type: 'textarea', label: 'Tóm tắt' },
    { name: 'body', type: 'richText', label: 'Nội dung' },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'article-categories',
      label: 'Chuyên mục bài viết',
    },
    { name: 'cover', type: 'relationship', relationTo: 'media-assets', label: 'Ảnh bìa' },
    { name: 'publishedAt', type: 'date', label: 'Ngày xuất bản' },
    {
      name: 'legacyUrl',
      type: 'text',
      label: 'Đường dẫn cũ (website cũ)',
      access: { read: ({ req }) => isStaff(req.user) },
    },
    seoField,
  ],
};

export const JobPostings: CollectionConfig = {
  slug: 'job-postings',
  labels: { singular: 'Tin tuyển dụng', plural: 'Tin tuyển dụng' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'sourceStatus', 'deadline', '_status', 'updatedAt'],
    description:
      'Tin tuyển dụng. Lương, quyền lợi, hạn nộp, ngày đăng và địa điểm làm việc là UNCONFIRMED cho tới khi BMSL xác nhận; chỉ xuất bản khi sourceStatus=CONFIRMED. Dữ liệu có cấu trúc JobPosting chỉ được phát ra khi đủ ngày đăng + địa điểm.',
  },
  access: {
    ...editorContentAccess,
    // The public REST boundary also requires CONFIRMED, so stored unconfirmed (for example legacy) jobs stay hidden.
    read: ({ req }) =>
      isStaff(req.user) ? true : { _status: { equals: 'published' }, sourceStatus: { equals: 'CONFIRMED' } },
  },
  versions: drafts,
  hooks: {
    beforeValidate: [
      ({ data, originalDoc, operation }) => {
        if (operation !== 'create' && operation !== 'update') return data;
        const problem = jobPublishGateProblem(mergeForPublishCheck(originalDoc, data));
        if (problem) throw new ValidationError({ errors: [{ message: problem, path: 'sourceStatus' }] });
        return data;
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', required: true, label: 'Vị trí tuyển dụng' },
    slugField,
    { name: 'description', type: 'richText', label: 'Mô tả công việc' },
    { name: 'requirements', type: 'richText', label: 'Yêu cầu' },
    { name: 'benefits', type: 'richText', label: 'Quyền lợi' },
    {
      name: 'salary',
      type: 'text',
      label: 'Mức lương',
      admin: { description: 'UNCONFIRMED: không nhập mức lương khi chưa có xác nhận của BMSL.' },
    },
    { name: 'deadline', type: 'date', label: 'Hạn nộp hồ sơ' },
    {
      name: 'datePosted',
      type: 'date',
      label: 'Ngày đăng',
      admin: {
        date: { pickerAppearance: 'dayOnly' },
        description:
          'Ngày đăng thực tế do BMSL cung cấp. Không suy ra từ ngày tạo bản ghi; để trống nếu chưa có xác nhận.',
      },
    },
    {
      name: 'jobLocation',
      type: 'group',
      label: 'Địa điểm làm việc',
      admin: {
        description:
          'Địa điểm làm việc do BMSL xác nhận. Không tự suy ra địa chỉ hay quốc gia; để trống nếu chưa có xác nhận.',
      },
      fields: [
        { name: 'streetAddress', type: 'text', label: 'Số nhà, tên đường' },
        {
          name: 'addressLocality',
          type: 'text',
          label: 'Quận/huyện hoặc thành phố',
          admin: { description: 'Quận/huyện hoặc thành phố làm việc.' },
        },
        {
          name: 'addressRegion',
          type: 'text',
          label: 'Tỉnh/thành phố',
          admin: { description: 'Tỉnh/thành phố.' },
        },
        { name: 'postalCode', type: 'text', label: 'Mã bưu chính' },
        {
          name: 'addressCountry',
          type: 'text',
          label: 'Mã quốc gia',
          admin: {
            description: 'Mã quốc gia ISO 3166-1 alpha-2 (hai chữ cái in hoa) do BMSL xác nhận; không mặc định.',
          },
          validate: (value: unknown) =>
            value === undefined || value === null || value === '' || (typeof value === 'string' && /^[A-Z]{2}$/.test(value))
              ? true
              : 'Mã quốc gia phải gồm đúng hai chữ cái in hoa (ISO 3166-1 alpha-2).',
        },
      ],
    },
    {
      name: 'sourceStatus',
      type: 'select',
      required: true,
      defaultValue: 'LEGACY-SOURCE',
      label: 'Trạng thái xác nhận nguồn',
      options: sourceStatusOptions,
      admin: {
        description:
          'LEGACY-SOURCE = chưa xác nhận (chỉ để nháp). Chỉ chọn CONFIRMED khi BMSL đã xác nhận tin tuyển dụng này (gồm ngày đăng và địa điểm nếu có).',
      },
    },
    { name: 'applyInstruction', type: 'textarea', required: true, label: 'Hướng dẫn ứng tuyển' },
    seoField,
  ],
};

export const Documents: CollectionConfig = {
  slug: 'documents',
  labels: { singular: 'Tài liệu', plural: 'Tài liệu' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', '_status', 'updatedAt'],
    description: 'Tài liệu tải về. Tệp là media: chỉ hiển thị công khai khi rightsStatus=APPROVED.',
  },
  access: editorContentAccess,
  versions: drafts,
  fields: [
    { name: 'title', type: 'text', required: true, label: 'Tên tài liệu' },
    { name: 'file', type: 'relationship', relationTo: 'media-assets', required: true, label: 'Tệp tài liệu' },
    { name: 'description', type: 'textarea', label: 'Mô tả' },
    { name: 'category', type: 'text', label: 'Phân loại' },
  ],
};
