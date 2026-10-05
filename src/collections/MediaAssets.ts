import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CollectionConfig } from 'payload';
import { isStaff, staffOnly } from '../access';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// width/height/mimeType/filename are populated by Payload's upload handling.
export const MediaAssets: CollectionConfig = {
  slug: 'media-assets',
  admin: {
    useAsTitle: 'alt',
    defaultColumns: ['filename', 'alt', 'rightsStatus', 'updatedAt'],
    description: 'Chỉ media có rightsStatus=APPROVED mới hiển thị công khai.',
  },
  upload: {
    staticDir: path.resolve(dirname, '../../media'),
    // Explicit raster list: `image/*` would admit image/svg+xml, which is active content served from our origin.
    mimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'application/pdf'],
  },
  access: {
    // Only media whose rights are APPROVED is publicly readable (blueprint 06 §9.5).
    read: ({ req }) => (isStaff(req.user) ? true : { rightsStatus: { equals: 'APPROVED' } }),
    create: staffOnly,
    update: staffOnly,
    delete: staffOnly,
  },
  fields: [
    { name: 'alt', type: 'text', required: true },
    {
      name: 'rightsStatus',
      type: 'select',
      required: true,
      defaultValue: 'UNCONFIRMED',
      options: ['UNCONFIRMED', 'APPROVED'],
      admin: { description: 'Chỉ đặt APPROVED khi BMSL xác nhận có quyền sử dụng tệp này.' },
    },
    {
      name: 'source',
      type: 'text',
      // Rights provenance is an internal note; approved media is public, its source/owner note is not.
      access: { read: ({ req }) => isStaff(req.user) },
      admin: { description: 'Nguồn/chủ sở hữu của tệp, dùng để kiểm tra bản quyền.' },
    },
  ],
};
