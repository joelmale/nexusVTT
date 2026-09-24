import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20_000,
    // The PostgreSQL suite starts one Docker container per file; keep files serial.
    fileParallelism: false,
  },
});
