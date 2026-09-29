import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'scripts/ci/release-promotion.test.mjs',
      'scripts/ci/release-validation-evidence.test.mjs',
    ],
    coverage: {
      provider: 'v8',
      include: [
        'scripts/ci/release-promotion.mjs',
        'scripts/ci/release-validation-evidence.mjs',
      ],
      reporter: ['text'],
      thresholds: { branches: 80, functions: 80, lines: 80, statements: 80 },
    },
  },
});
