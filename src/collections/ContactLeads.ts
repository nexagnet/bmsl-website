import type { CollectionConfig } from 'payload';
import { adminOnly, adminOnlyField, nobody } from '../access';
import { resolveLeadEmailConfig } from '../lib/lead-email-config';
import { NOTIFICATION_STATES, queueLeadNotification } from '../lib/lead-notification';

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
  hooks: {
    // Outbox (Issue #82): the notification intent is part of the lead row, decided at insert time. A lead that arrives
    // while e-mail is OFF is marked not_configured and is never sent retroactively.
    beforeChange: [
      ({ data, operation }) => {
        if (operation !== 'create') return data;
        const state = resolveLeadEmailConfig().enabled ? 'pending' : 'not_configured';
        return { ...data, notification: { ...(data.notification ?? {}), state } };
      },
    ],
    // The delivery job is created with the SAME req => the same database transaction as the lead insert: either both
    // commit or neither does, so there is no window where a stored lead has no notification intent.
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation === 'create' && doc.notification?.state === 'pending') await queueLeadNotification(req.payload, doc.id, req);
        return doc;
      },
    ],
  },
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
    {
      // Delivery state of the e-mail notification. Operational data only (no lead content), written by trusted server
      // code. An ADMIN may set state back to 'pending' to re-queue a dead notification.
      name: 'notification',
      type: 'group',
      label: 'Thông báo email',
      admin: { description: 'Trạng thái gửi email thông báo. Đặt lại thành "pending" để gửi lại một yêu cầu đã dừng (dead).' },
      fields: [
        {
          name: 'state',
          type: 'select',
          label: 'Trạng thái',
          options: NOTIFICATION_STATES.map((value) => ({ label: value, value })),
          access: { read: adminOnlyField, update: adminOnlyField },
        },
        { name: 'attempts', type: 'number', label: 'Số lần thử', admin: { readOnly: true } },
        { name: 'lastAttemptAt', type: 'date', label: 'Lần thử gần nhất', admin: { readOnly: true } },
        { name: 'leaseUntil', type: 'date', label: 'Khóa đến', admin: { readOnly: true } },
        { name: 'sentAt', type: 'date', label: 'Đã gửi lúc', admin: { readOnly: true } },
        { name: 'lastError', type: 'text', label: 'Mã lỗi gần nhất', admin: { readOnly: true } },
      ],
    },
  ],
};
