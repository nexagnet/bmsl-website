import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CollectionConfig } from 'payload';
import { isStaff, staffOnly } from '../access';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// width/height/mimeType/filename are populated by Payload's upload handling.
export const MediaAssets: CollectionConfig = {
  slug: 'media-assets',
  admin: { useAsTitle: 'alt' },
  upload: {
    staticDir: path.resolve(dirname, '../../media'),
    mimeTypes: ['image/*', 'application/pdf'],
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
    },
    { name: 'source', type: 'text' },
  ],
};
