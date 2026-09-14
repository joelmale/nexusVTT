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
      all: true, // Include all source files, even untested ones
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

        // Server-side code (tested separately if needed)
        'server/',

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
        // Progressive thresholds - gradually increase as test coverage improves
        // Current coverage: ~21% (as of Dec 2025)
        // Target: Prevent regression and encourage incremental improvement
        lines: 20,
        functions: 18,
        branches: 16,
        statements: 20,
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
