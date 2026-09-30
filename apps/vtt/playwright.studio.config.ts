import { defineConfig, devices } from '@playwright/test';

/**
 * Campaign Studio (apps/codex/services/dm-ui) suite. It drives the demo
 * routes (`/demo/:fixtureSlug/...`), which are fixture-backed, so like the
 * `ui` project it needs only a Vite dev server - no backend, no database.
 * dm-ui lives in another workspace, so it gets its own config rather than a
 * second webServer on the VTT one (which would start it for every VTT run).
 *
 * Screenshot baselines are opt-in: set STUDIO_VISUAL=1 (see the spec).
 */
const STUDIO_PORT = Number(process.env.STUDIO_TEST_PORT ?? 5198);
const studioBaseURL =
  process.env.STUDIO_TEST_BASE_URL ?? `http://127.0.0.1:${STUDIO_PORT}`;

export default defineConfig({
  testDir: './tests/studio',
  outputDir: 'test-results/studio',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // A cold Vite dev server re-optimizes deps and reloads on first load; retry once.
  retries: 1,
  timeout: 60_000,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' },
  },
  reporter: process.env.CI
    ? [
        ['github'],
        ['html', { open: 'never', outputFolder: 'playwright-report' }],
      ]
    : [
        ['list'],
        ['html', { open: 'never', outputFolder: 'playwright-report' }],
      ],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: studioBaseURL,
    viewport: { width: 1586, height: 992 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'studio' }],

  webServer: process.env.STUDIO_TEST_BASE_URL
    ? undefined
    : {
        command: `npm run dev --workspace @nexuscodex/dm-ui -- --port ${STUDIO_PORT} --strictPort --host 127.0.0.1`,
        cwd: '../..',
        url: `${studioBaseURL}/codex-dm/`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },
});
