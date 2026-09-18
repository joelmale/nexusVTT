import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

/**
 * Integration-only Vitest config.
 *
 * Identical to the base config except that it layers on the destructive-run
 * database guard (tests/setup.integration.ts). Kept as a separate file rather
 * than a `projects` split so the coverage configuration and its CI thresholds
 * continue to come from exactly one place: vitest.config.ts.
 *
 * `include` is assigned AFTER the merge, not through it: mergeConfig
 * concatenates arrays, so merging an include list appends to the base one and
 * drags every unit test into the integration run -- where the database guard
 * then fails them all.
 */
const merged = mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      setupFiles: ['./tests/setup.ts', './tests/setup.integration.ts'],
    },
  }),
);

merged.test = {
  ...merged.test,
  include: ['tests/integration/**/*.{test,spec}.{ts,tsx}'],
};

export default merged;
