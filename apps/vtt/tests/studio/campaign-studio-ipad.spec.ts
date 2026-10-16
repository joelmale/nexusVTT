import { devices, expect, test, type Page } from '@playwright/test';

/**
 * Campaign Studio on an iPad Air (touch, coarse pointer). Portrait is 820px
 * wide, which is exactly where the campaign rail collapses, so the drawer
 * navigation matters; landscape (1180px) keeps the rail but has no Ctrl+K.
 */
const BASE = '/codex-dm/demo/ashes-of-veyra';
const IPAD_PORTRAIT = { width: 820, height: 1180 };
const IPAD_LANDSCAPE = { width: 1180, height: 820 };
const MIN_TARGET = 40; // HIG asks for 44; leave a little rounding slack.

// `devices` only supplies the touch/mobile flags; the viewport is per test.
const touch = {
  hasTouch: devices['iPad (gen 7)'].hasTouch,
  isMobile: devices['iPad (gen 7)'].isMobile,
};

test.beforeEach(async ({ page }) => {
  // Only API calls: source files under .../src/api/ must still reach Vite.
  await page.route('**/api/**', (route) =>
    ['fetch', 'xhr'].includes(route.request().resourceType())
      ? route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '[]',
        })
      : route.fallback(),
  );
  await page.route('**/config.js', (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: '' }),
  );
});

async function undersizedControls(page: Page) {
  return page.evaluate((min) => {
    const found: string[] = [];
    const selector =
      'button, a[class], select, input:not([type=checkbox]):not([type=radio]), textarea, [role=tab]';
    for (const el of document.querySelectorAll(selector)) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (el.closest('[class*="mapPin"]')) continue;
      if (box.height < min) {
        found.push(
          `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(box.width)}x${Math.round(box.height)}`,
        );
      }
    }
    return found;
  }, MIN_TARGET);
}

test.describe('iPad Air portrait', () => {
  test.use({ ...touch, viewport: IPAD_PORTRAIT });

  test('reaches every section through the navigation drawer', async ({
    page,
  }) => {
    await page.goto(`${BASE}/sessions`);
    await page.getByRole('button', { name: 'Open campaign navigation' }).tap();
    await page.getByRole('button', { name: 'NPCs' }).tap();
    await expect(page).toHaveURL(/\/npcs$/);
    // The drawer closes itself after navigating.
    await expect(
      page.getByRole('button', { name: 'Close campaign navigation' }),
    ).toHaveCount(0);
  });

  test('has touch-sized controls on the main sections', async ({ page }) => {
    for (const route of ['overview', 'sessions', 'npcs', 'quests', 'maps']) {
      await page.goto(`${BASE}/${route}`);
      await page.waitForLoadState('networkidle');
      expect(await undersizedControls(page), route).toEqual([]);
    }
  });

  test('map layers and details open as drawers', async ({ page }) => {
    await page.goto(`${BASE}/maps/map-glass-harbor`);
    await page.getByRole('button', { name: 'Layers', exact: true }).tap();
    await expect(page.getByText('Locations / Pins')).toBeInViewport();
    await page.getByRole('button', { name: /Open North Docks details/ }).tap();
    await expect(
      page.getByRole('heading', { name: 'North Docks' }),
    ).toBeInViewport();
  });
});

test.describe('iPad Air landscape', () => {
  test.use({ ...touch, viewport: IPAD_LANDSCAPE });

  test('opens search from the rail without a keyboard', async ({ page }) => {
    await page.goto(`${BASE}/sessions`);
    await page.getByRole('button', { name: 'Search', exact: true }).tap();
    await expect(
      page.getByRole('dialog', { name: 'Search campaign' }),
    ).toBeVisible();
  });

  test('map details open as a drawer', async ({ page }) => {
    await page.goto(`${BASE}/maps/map-glass-harbor`);
    await page.getByRole('button', { name: 'Details', exact: true }).tap();
    await expect(
      page.getByRole('complementary', { name: 'Selected location details' }),
    ).toBeInViewport();
  });
});
