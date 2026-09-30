import { expect, test, type Page } from '@playwright/test';

/**
 * Campaign Studio demo routes. Fixture-backed, so no backend is required.
 *
 * Visual baselines are OPT-IN: `STUDIO_VISUAL=1`. Baselines are
 * platform-suffixed by Playwright (-win32 / -linux), none are committed yet,
 * and CI does not run this suite, so they are skipped by default to avoid
 * red runs from font/rendering differences. To create or refresh them:
 *   STUDIO_VISUAL=1 npx playwright test -c playwright.studio.config.ts --update-snapshots
 */
const BASE = '/codex-dm/demo/ashes-of-veyra';
const VISUAL = process.env.STUDIO_VISUAL === '1';

const SECTIONS = [
  { label: 'Sessions', route: 'sessions' },
  { label: 'World', route: 'world' },
  { label: 'NPCs', route: 'npcs' },
  { label: 'Factions', route: 'factions' },
  { label: 'Quests', route: 'quests' },
  { label: 'Encounters', route: 'encounters' },
  { label: 'Maps', route: 'maps' },
  { label: 'Notes', route: 'notes' },
] as const;

const EXAMPLE_CAMPAIGNS = [
  'Ashes of Veyra',
  'Crown of Cinders',
  'Lanterns of Mourningfen',
  'Stars Below Kharad',
];

// Demo routes need no backend, but the shell still asks for the server campaign
// list and the runtime config; answer both locally so nothing 404s or 500s.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/config.js', (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: '' }),
  );
});

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

const rail = (page: Page) =>
  page.getByRole('complementary', { name: 'Campaign navigation' });

test.describe('Campaign Studio demo routes', () => {
  test('overview loads without console errors', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(`${BASE}/overview`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(rail(page)).toBeVisible();
    expect(errors).toEqual([]);
  });

  for (const section of SECTIONS) {
    test(`${section.route} route loads without console errors`, async ({
      page,
    }) => {
      const errors = trackErrors(page);
      await page.goto(`${BASE}/${section.route}`);
      await expect(
        rail(page).getByRole('button', { name: section.label }),
      ).toHaveAttribute('aria-current', 'page');
      await expect(page.getByRole('heading').first()).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test('session plan and map preparation load without console errors', async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await page.goto(`${BASE}/sessions/session-12/plan`);
    await expect(page.getByRole('heading').first()).toBeVisible();
    await page.goto(`${BASE}/maps/map-glass-harbor`);
    await expect(page.getByRole('heading').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('rail navigation moves between sections', async ({ page }) => {
    // The Ashes overview renders its own bespoke rail; section routes share
    // the StudioFrame rail, so start from one of those.
    await page.goto(`${BASE}/sessions`);
    for (const section of SECTIONS) {
      await rail(page).getByRole('button', { name: section.label }).click();
      await expect(page).toHaveURL(new RegExp(`${BASE}/${section.route}`));
      await expect(
        rail(page).getByRole('button', { name: section.label }),
      ).toHaveAttribute('aria-current', 'page');
    }
    await rail(page)
      .getByRole('button', { name: 'Overview', exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/overview$`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('planned capabilities show a notice that changes no data', async ({
    page,
  }) => {
    await page.goto(`${BASE}/sessions`);
    await rail(page).getByRole('button', { name: 'Settings' }).click();
    const notice = page.getByRole('status').filter({ hasText: 'Planned:' });
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('No data changed.');
    await page
      .getByRole('button', { name: 'Dismiss capability notice' })
      .click();
    await expect(notice).toBeHidden();
  });

  test('campaign switcher lists all four example campaigns', async ({
    page,
  }) => {
    await page.goto(`${BASE}/sessions`);
    await rail(page)
      .getByRole('button', { name: /Ashes of Veyra/ })
      .click();
    const menu = page.getByRole('menu', { name: 'Campaigns' });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitemradio')).toHaveCount(
      EXAMPLE_CAMPAIGNS.length,
    );
    for (const name of EXAMPLE_CAMPAIGNS) {
      await expect(menu.getByRole('menuitemradio', { name })).toBeVisible();
    }
  });
});

test.describe('Campaign Studio visual baselines', () => {
  test.skip(!VISUAL, 'set STUDIO_VISUAL=1 to compare screenshot baselines');

  const screens = [
    { name: 'overview', path: `${BASE}/overview` },
    { name: 'session-plan', path: `${BASE}/sessions/session-12/plan` },
    { name: 'map-preparation', path: `${BASE}/maps/map-glass-harbor` },
  ];
  const viewports = [
    { width: 1586, height: 992 },
    { width: 1280, height: 800 },
  ];

  for (const viewport of viewports) {
    for (const screen of screens) {
      test(`${screen.name} at ${viewport.width}x${viewport.height}`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await page.goto(screen.path);
        await page.waitForLoadState('networkidle');
        await page.evaluate(() => document.fonts.ready);
        await expect(page).toHaveScreenshot(
          `${screen.name}-${viewport.width}x${viewport.height}.png`,
        );
      });
    }
  }
});
