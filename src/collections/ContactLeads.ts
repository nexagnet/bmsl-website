import type { CollectionConfig } from 'payload';
import { adminOnly, nobody } from '../access';

export const REQUEST_TYPES = ['khao-sat', 'bao-gia', 'khac'] as const;

const REQUEST_TYPE_LABELS: Record<(typeof REQUEST_TYPES)[number], string> = {
  'khao-sat': 'Khảo sát',
  'bao-gia': 'Báo giá',
  khac: 'Khác',
};

// PII-capable durable business data (blueprint 06 §5). Provisional security defaults, NOT BMSL decisions:
// - read/update: ADMIN only (EDITOR visibility is an OPEN OWNER-DECISION; no extra privilege granted);
// - delete: nobody via API (retention/deletion policy is an OPEN OWNER-DECISION);
// - create: ADMIN or trusted server code via the Local API (see lib/contact-lead.ts). No public
//   REST/GraphQL create until W4 adds anti-spam.
export const ContactLeads: CollectionConfig = {
  slug: 'contact-leads',
  labels: { singular: 'Yêu cầu liên hệ', plural: 'Yêu cầu liên hệ' },
  admin: {
    useAsTitle: 'name',
    description: 'Thông tin cá nhân của người gửi form liên hệ. Chỉ quản trị viên được xem; không sao chép ra ngoài hệ thống.',
  },
  access: { read: adminOnly, create: adminOnly, update: adminOnly, delete: nobody },
  fields: [
    { name: 'name', type: 'text', required: true, label: 'Họ tên người gửi' },
    { name: 'phone', type: 'text', required: true, label: 'Số điện thoại' },
    { name: 'email', type: 'email', label: 'Email' },
    {
      name: 'requestType',
      type: 'select',
      required: true,
      label: 'Loại yêu cầu',
      options: REQUEST_TYPES.map((value) => ({ label: REQUEST_TYPE_LABELS[value], value })),
    },
    { name: 'message', type: 'textarea', required: true, label: 'Nội dung yêu cầu' },
    {
      name: 'consent',
      type: 'group',
      label: 'Đồng ý xử lý dữ liệu',
      fields: [
        { name: 'given', type: 'checkbox', required: true, label: 'Đã đồng ý' },
        { name: 'at', type: 'date', required: true, label: 'Thời điểm đồng ý' },
      ],
    },
    { name: 'sourcePage', type: 'text', required: true, label: 'Trang gửi yêu cầu' },
    { name: 'utm', type: 'json', label: 'Tham số chiến dịch (UTM)' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'new',
      label: 'Trạng thái xử lý',
      options: [
        { label: 'Mới', value: 'new' },
        { label: 'Đã xử lý', value: 'handled' },
      ],
    },
    { name: 'spamScore', type: 'number', label: 'Điểm nghi spam' },
  ],
};
