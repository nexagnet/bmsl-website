import type { CollectionConfig } from 'payload';
import { adminOnly } from '../access';

export const Redirects: CollectionConfig = {
  slug: 'redirects',
  labels: { singular: 'Chuyển hướng URL', plural: 'Chuyển hướng URL' },
  admin: { useAsTitle: 'from' },
  access: { read: adminOnly, create: adminOnly, update: adminOnly, delete: adminOnly },
  fields: [
    { name: 'from', type: 'text', required: true, unique: true, index: true, label: 'Đường dẫn cũ' },
    { name: 'to', type: 'text', required: true, label: 'Đường dẫn mới' },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: '301',
      label: 'Kiểu chuyển hướng',
      options: [{ label: '301 – chuyển hướng vĩnh viễn', value: '301' }],
    },
  ],
};
