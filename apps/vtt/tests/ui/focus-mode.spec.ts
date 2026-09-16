import { test, expect, gotoGame } from './support/gameFixture';
import { tabbableInsideChrome } from './support/layoutProbes';

/**
 * Focus mode. The assertions that matter here - that hidden chrome actually
 * leaves the tab order, and that a document-level flag reaches portalled
 * chrome - need a real browser: `#portal-root` is a sibling of `#root`, and
 * jsdom has no notion of `inert` removing things from tab order.
 */

test('F hides every piece of chrome and F restores it', async ({ page }) => {
  await gotoGame(page);

  // The dock is always-present chrome, so it is a stable probe. (Some other
  // chrome roots - the Atlas dock panel - are legitimately hidden when closed,
  // so `[data-chrome]` in general is not.)
  const dock = page.getByRole('tablist', { name: 'Panels' });
  await expect(dock).toBeVisible();

  await page.locator('.layout-scene').click({ position: { x: 400, y: 400 } });
  await page.keyboard.press('f');

  await expect(page.locator('html')).toHaveAttribute('data-focus-mode', 'on');
  await expect(dock).toBeHidden();

  await page.keyboard.press('f');
  await expect(page.locator('html')).not.toHaveAttribute('data-focus-mode', 'on');
  await expect(dock).toBeVisible();
});

test('hidden chrome is inert and unreachable by Tab', async ({ page }) => {
  await gotoGame(page);

  expect(await tabbableInsideChrome(page)).toBeGreaterThan(0);

  await page.locator('.layout-scene').click({ position: { x: 400, y: 400 } });
  await page.keyboard.press('f');
  await expect(page.locator('html')).toHaveAttribute('data-focus-mode', 'on');

  // Wait past the visibility transition delay.
  await page.waitForTimeout(400);

  const roots = page.locator('[data-chrome]');
  const count = await roots.count();
  for (let i = 0; i < count; i += 1) {
    await expect(roots.nth(i)).toHaveAttribute('inert', '');
  }

  expect(
    await tabbableInsideChrome(page),
    'no control inside hidden chrome may remain tabbable',
  ).toBe(0);
});

test('reaches portal-mounted chrome, not just the layout container', async ({ page }) => {
  // FloatingPanel renders into #portal-root, a SIBLING of #root, so a rule
  // scoped to .game-layout could never hide it.
  await gotoGame(page, { panels: ['chat'] });

  const panel = page.getByRole('dialog', { name: 'Chat', exact: true });
  await expect(panel).toBeVisible();
  // React serialises the boolean prop as data-chrome="true".
  await expect(panel).toHaveAttribute('data-chrome', /.*/);

  await page.locator('.layout-scene').click({ position: { x: 400, y: 400 } });
  await page.keyboard.press('f');

  await expect(panel).toBeHidden();
});

test('the hotkey does not fire while typing', async ({ page }) => {
  await gotoGame(page, { panels: ['chat'] });

  const input = page.getByPlaceholder(/Type a message/i);
  await input.click();
  await input.fill('f');

  await expect(page.locator('html')).not.toHaveAttribute('data-focus-mode', 'on');
  await expect(input).toHaveValue('f');
});
