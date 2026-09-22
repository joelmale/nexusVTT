import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'scripts/ci/actions-timing-lib.test.mjs',
      'scripts/ci/report-actions-timing.test.mjs',
    ],
    coverage: {
      include: [
        'scripts/ci/actions-timing-lib.mjs',
        'scripts/ci/report-actions-timing.mjs',
      ],
      provider: 'v8',
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
