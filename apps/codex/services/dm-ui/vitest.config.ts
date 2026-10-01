import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/tests/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      restoreMocks: true,
      // Section tests render full example campaigns in jsdom; under a loaded
      // runner they can approach the 5s default.
      testTimeout: 15_000,
      unstubGlobals: true,
    },
  }),
);
