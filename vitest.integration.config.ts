import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Same alias as tsconfig paths, so integration tests can exercise the real public read path (src/lib/cms.ts).
  resolve: { alias: { '@payload-config': path.resolve(import.meta.dirname, 'src/payload.config.ts') } },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 120000,
    // Payload tests reset the disposable database schema; never run files concurrently.
    fileParallelism: false,
  },
});
