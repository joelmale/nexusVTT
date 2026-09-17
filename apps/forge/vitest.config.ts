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
        // Ratchet: set just under measured coverage so the gate fails on a
        // REGRESSION rather than describing an aspiration. Raise these
        // whenever real coverage rises; never lower them without a reason.
        //
        // Measured 2026-09-17: statements 71.2, branches 55.5,
        // functions 51.1, lines 71.7 (35 files, 426 tests).
        //
        // These replace an 80/75/80/80 block that was nested under a `global`
        // key. Vitest has no `global` key -- it reads an unrecognized key as a
        // file glob, which matched nothing, so that gate enforced NOTHING and
        // CI passed at 71% statements / 51% functions. Keep these keys flat.
        statements: 70,
        branches: 54,
        functions: 50,
        lines: 70
      }
    },
    globals: true
  }
});