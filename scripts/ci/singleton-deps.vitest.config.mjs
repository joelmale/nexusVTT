import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/ci/check-singleton-deps.test.mjs'],
  },
});
