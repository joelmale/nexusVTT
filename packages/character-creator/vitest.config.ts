import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@nexus/character-contracts': path.resolve(
        __dirname,
        '../character-contracts/src/index.ts',
      ),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'scripts/',
        'tests/',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.d.ts',
        'src/data/**/*.json',
        'src/data/srd/**',
      ],
      thresholds: {
        lines: 70,
        functions: 65,
        branches: 55,
        statements: 70,
      },
    },
  },
});
