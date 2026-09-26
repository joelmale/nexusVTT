import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/ci/service-catalog.test.mjs'],
    coverage: {
      provider: 'v8',
      include: ['scripts/ci/service-catalog.mjs'],
      reporter: ['text'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
