/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/stores': path.resolve(__dirname, './src/stores'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/services': path.resolve(__dirname, './src/services'),
      // Shared character creator (build-time workspace import).
      '@nexus/character-creator/styles.css': path.resolve(
        __dirname,
        '../../packages/character-creator/dist/creator.css',
      ),
      '@nexus/character-creator': path.resolve(
        __dirname,
        '../../packages/character-creator/src/index.ts',
      ),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8', // Fast native V8 coverage
      reporter: ['text', 'json', 'html', 'lcov'], // Multiple formats for different use cases
      reportsDirectory: './coverage', // Coverage reports output directory
      // Vitest 4 removed the old `coverage.all` switch. Explicit inclusion is
      // the enforcement boundary: production files stay in the denominator
      // even when no test imports them.
      include: ['src/**/*.{ts,tsx}', 'server/**/*.ts'],
      exclude: [
        // Dependencies and build artifacts
        'node_modules/',
        'dist/',
        'build/',

        // Test files and setup
        'tests/',
        'test/',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '*.config.ts',
        '*.config.js',
        '**/*.config.ts',
        '**/*.config.js',

        // Type definitions and declarations
        'src/types/',
        'src/**/*.d.ts',
        '**/*.d.ts',

        // Server-side code IS measured (tests live in tests/unit/server/).
        // Only non-logic server files are excluded.
        'server/migrations/',
        'server/types.ts',

        // Infrastructure and tooling
        '.github/',
        'scripts/',
        'docker/',

        // Entry points and app setup (mostly boilerplate)
        'src/main.tsx',
        'src/App.tsx',
        'src/index.tsx',

        // CSS and style files
        'src/styles/',
        '**/*.css',
        '**/*.scss',
        '**/*.sass',
        '**/*.less',

        // Static assets and constants
        'src/assets/',
        'static-assets/',
        'public/',

        // Mock data and fixtures
        'src/**/__mocks__/',
        'src/**/__fixtures__/',
        'src/**/mocks/',
        'src/**/fixtures/',

        // Constants and configuration files (pure data, no logic)
        'src/**/constants.ts',
        'src/**/constants/*.ts',
        'src/**/config.ts',
        'src/services/devSeed.ts',
        'src/utils/devMode.ts',

        // Generated files
        'src/vite-env.d.ts',
        'src/**/*.generated.ts',

        // Route configuration files (often just data structures)
        'src/routes.ts',
        'src/routes.tsx',

        // Story files (Storybook)
        '**/*.stories.ts',
        '**/*.stories.tsx',
      ],
      thresholds: {
        // Ratchet: these sit just under the measured coverage of the current
        // suite, so the gate fails when coverage REGRESSES rather than
        // describing an aspiration. Raise them whenever real coverage rises.
        //
        // Recalibrated 2026-09-23: the previous baseline (statements 53.3,
        // branches 43.2, functions 52.7, lines 53.9, "measured 2026-09-18")
        // was itself computed from a broken CI aggregate -- the
        // integration-test container and the unit-test shards resolved the
        // `@/...` alias to two different absolute paths, so
        // `vitest --merge-reports` double-counted every apps/vtt/src file
        // and inflated the merged percentage. With that merge path fixed
        // (see docker/docker-compose.test.yml + .github/workflows/ci.yml,
        // HOST_WORKSPACE), a full local `vitest run --coverage` across the
        // whole suite (unit + integration, current main incl. the coverage
        // and server-bootstrap work merged 2026-09-22) measured:
        // statements 49.72, branches 40.48, functions 47.97, lines 50.39.
        // Thresholds below are the floor of that measurement, matching this
        // file's existing ratchet convention. Raise them again as real
        // coverage improves -- do not raise them back toward the old,
        // inflated baseline.
        //
        // NOTE: these keys must stay flat. Vitest treats an unknown key such
        // as Jest's `global: { ... }` as a file glob, matches nothing, and
        // enforces nothing -- verified by probe on 2026-09-17.
        lines: 50,
        functions: 47,
        branches: 40,
        statements: 49,
      },
    },
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'tests/unit/**/*.{test,spec}.{ts,tsx}',
      'tests/integration/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache',
      'tests/layout.test.ts',
      'tests/visual-regression.test.ts',
      'tests/e2e/**/*',
    ],
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
    isolate: true,
    threads: true,
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
  },
  server: {
    port: parseInt(process.env.PORT || '5173'),
    host: true,
    open: true,
  },
  build: {
    sourcemap: true,
  },
});
