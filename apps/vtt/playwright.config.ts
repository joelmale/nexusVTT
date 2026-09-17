import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173';

/**
 * The UI suite runs against a plain Vite dev server - no Docker, no
 * PostgreSQL, no Redis. It exercises layout, z-order, focus and docking, none
 * of which need a backend, and drives the stores through the dev-only bridge
 * in `src/utils/testBridge.ts`. Keeping it off the managed stack is the whole
 * point: it runs in seconds and in parallel.
 */
const UI_PORT = Number(process.env.UI_TEST_PORT ?? 5199);
const uiBaseURL = process.env.UI_TEST_BASE_URL ?? `http://127.0.0.1:${UI_PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 15_000,
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
    baseURL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testDir: './tests/e2e',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'ui',
      testDir: './tests/ui',
      // Independent of the managed stack, so it can actually use the machine.
      fullyParallel: true,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: uiBaseURL,
        viewport: { width: 1440, height: 900 },
      },
    },
  ],

  // Only started when the `ui` project runs; the managed e2e script supplies
  // its own server on 4173 and sets E2E_BASE_URL.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --port ${UI_PORT} --strictPort`,
        url: uiBaseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },
});
