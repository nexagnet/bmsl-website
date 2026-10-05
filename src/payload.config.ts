import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { buildConfig } from 'payload';
import { Users } from './collections/Users';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default buildConfig({
  admin: { user: Users.slug },
  collections: [Users],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET ?? '',
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL ?? '' },
  }),
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
});
