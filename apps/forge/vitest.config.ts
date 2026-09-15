import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const characterCreatorSrc = path.resolve(
  dirname,
  '../../packages/character-creator/src',
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@nexus\/character-creator$/,
        replacement: path.join(characterCreatorSrc, 'index.ts'),
      },
      {
        find: /^@nexus\/character-creator\/(.*)$/,
        replacement: path.join(characterCreatorSrc, '$1'),
      },
    ],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // The shared character creator's tests live with its source in the
    // workspace package; Forge is the app that owns its dev loop, so they run
    // here rather than in a separate runner.
    include: [
      'src/**/*.{test,spec}.?(c|m)[jt]s?(x)',
      '../../packages/character-creator/src/**/*.{test,spec}.?(c|m)[jt]s?(x)',
    ],
    coverage: {
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        'dist/',
        'coverage/',
        '**/*.config.*',
        'src/main.tsx',
        'src/vite-env.d.ts'
      ],
      thresholds: {
        global: {
          statements: 80,
          branches: 75,
          functions: 80,
          lines: 80
        }
      }
    },
    globals: true
  }
});