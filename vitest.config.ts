import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The integration support rules (tests/integration/support/*.test.ts) are pure and need no database.
    include: ['src/**/*.test.ts', 'tests/integration/support/**/*.test.ts'],
  },
});
