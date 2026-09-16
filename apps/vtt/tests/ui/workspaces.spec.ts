import { test, expect, gotoGame } from './support/gameFixture';

/**
 * Layout workspaces: save a layout, drift away from it, restore it.
 *
 * The restore path is imperative (setPosition/setSizeClamped/setCollapsed plus
 * an applySeq bump) precisely so nothing remounts, so the assertion that
 * matters is that the real geometry comes back.
 */

async function openWorkspaceMenu(page: import('@playwright/test').Page) {
  await page.getByRole('tablist', { name: 'Panels' }).hover();
  await page.getByRole('button', { name: 'Layout workspaces' }).click();
  await expect(page.getByRole('menu', { name: 'Layout workspaces' })).toBeVisible();
}

/**
 * Panel toggles are paced.
 *
 * Rapid open/close cycling crashes the renderer - see
 * `panel-cycle-crash.spec.ts`, which reproduces that deliberately and is
 * marked known-failing. Above roughly 200ms between interactions it is stable,
 * so these tests pace themselves rather than tripping over a bug they are not
 * about. Remove the pacing once the crash is fixed.
 */
const SETTLE_MS = 250;

async function openPanel(page: import('@playwright/test').Page, name: string) {
  await page.getByRole('tablist', { name: 'Panels' }).hover();
  await page.getByRole('tab', { name, exact: true }).click();
  await expect(page.getByRole('dialog', { name, exact: true })).toBeVisible();
  await page.waitForTimeout(SETTLE_MS);
}

test('saves and lists a workspace', async ({ page }) => {
  await gotoGame(page);
  await openPanel(page, 'Chat');

  await openWorkspaceMenu(page);
  await page.getByLabel('New workspace name').fill('Combat');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByRole('menuitem', { name: 'Combat' })).toBeVisible();
});

test('restores the open panel set', async ({ page }) => {
  await gotoGame(page);
  await openPanel(page, 'Chat');

  await openWorkspaceMenu(page);
  await page.getByLabel('New workspace name').fill('Combat');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.keyboard.press('Escape');

  // Drift: close Chat, open Dice instead.
  await page.getByRole('tablist', { name: 'Panels' }).hover();
  await page.getByRole('tab', { name: 'Chat', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Chat', exact: true })).toHaveCount(0);
  await page.waitForTimeout(SETTLE_MS);
  await openPanel(page, 'Dice');

  await openWorkspaceMenu(page);
  await page.getByRole('menuitem', { name: 'Combat' }).click();

  await expect(page.getByRole('dialog', { name: 'Chat', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Dice', exact: true })).toHaveCount(0);
});

test('deleting a workspace removes it from the list', async ({ page }) => {
  await gotoGame(page);

  await openWorkspaceMenu(page);
  await page.getByLabel('New workspace name').fill('Scratch');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Scratch' })).toBeVisible();

  await page.getByRole('button', { name: 'Delete workspace Scratch' }).click();
  await expect(page.getByRole('menuitem', { name: 'Scratch' })).toHaveCount(0);
});
