import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APIError, type CollectionConfig } from 'payload';
import { isStaff, staffOnly } from '../access';
import { ALLOWED_UPLOAD_MIME_TYPES, uploadProblem } from '../lib/upload-policy';

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
    mimeTypes: ALLOWED_UPLOAD_MIME_TYPES,
  },
  hooks: {
    // Name, declared type and bytes must agree on an approved kind (src/lib/upload-policy.ts); Payload alone would
    // accept real PNG bytes labelled .html and trusts the declared type when it cannot sniff the bytes.
    beforeOperation: [
      ({ args, operation, req }) => {
        if ((operation === 'create' || operation === 'update') && req.file) {
          const problem = uploadProblem(req.file.name, req.file.mimetype, req.file.data);
          if (problem) throw new APIError(problem, 400, undefined, true);
        }
        return args;
      },
    ],
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
