import { test, expect, gotoGame } from './support/gameFixture';
import {
  isTopmostAtCentre,
  panelAtPoint,
  panelTransforms,
} from './support/layoutProbes';

/**
 * Panel layout and stacking - the behaviours jsdom cannot express, because it
 * has no layout engine and therefore no hit-testing.
 */

async function openPanel(page: import('@playwright/test').Page, name: string) {
  await page.getByRole('tablist', { name: 'Panels' }).hover();
  await page.getByRole('tab', { name, exact: true }).click();
  await expect(page.getByRole('dialog', { name, exact: true })).toBeVisible();
}

test('opens several panels at once', async ({ page }) => {
  await gotoGame(page);

  await openPanel(page, 'Chat');
  await openPanel(page, 'Dice');

  await expect(page.getByRole('dialog', { name: 'Chat', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Dice', exact: true })).toBeVisible();
});

test('cascades panels so they do not stack at identical coordinates', async ({ page }) => {
  await gotoGame(page);

  await openPanel(page, 'Chat');
  await openPanel(page, 'Dice');

  const transforms = await panelTransforms(page);
  expect(transforms.Chat).toBeTruthy();
  expect(transforms.Dice).toBeTruthy();
  expect(
    transforms.Chat,
    'a second panel must not open exactly on top of the first',
  ).not.toBe(transforms.Dice);
});

test('the most recently opened panel is the top hit-test target', async ({ page }) => {
  await gotoGame(page);

  await openPanel(page, 'Chat');
  await openPanel(page, 'Dice');

  const dice = page.getByRole('dialog', { name: 'Dice', exact: true });
  expect(await isTopmostAtCentre(dice)).toBe(true);
});

test('clicking a buried panel raises it above the others', async ({ page }) => {
  await gotoGame(page);

  await openPanel(page, 'Chat');
  await openPanel(page, 'Dice');

  const chat = page.getByRole('dialog', { name: 'Chat', exact: true });
  const box = await chat.boundingBox();
  expect(box).not.toBeNull();

  // Title bar: past the 12px corner resize handle, left of the action buttons.
  await chat.click({ position: { x: 60, y: 18 } });

  expect(await panelAtPoint(page, box!.x + 60, box!.y + 18)).toBe('Chat');
});

test('Escape closes only the topmost panel', async ({ page }) => {
  await gotoGame(page);

  await openPanel(page, 'Chat');
  await openPanel(page, 'Dice');

  await page.keyboard.press('Escape');

  await expect(page.getByRole('dialog', { name: 'Dice', exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Chat', exact: true })).toBeVisible();
});

test('the workspace menu is not clipped by the dock', async ({ page }) => {
  // Regression: the dock sets `overflow: hidden`, so an absolutely-positioned
  // popover inside it was in the DOM and "visible" to jsdom but painted
  // nowhere. Only a real layout engine catches this.
  await gotoGame(page);

  await page.getByRole('tablist', { name: 'Panels' }).hover();
  await page.getByRole('button', { name: 'Layout workspaces' }).click();

  const menu = page.getByRole('menu', { name: 'Layout workspaces' });
  await expect(menu).toBeVisible();
  expect(await isTopmostAtCentre(menu)).toBe(true);
});

test('the player cluster panel is laid out horizontally without overflowing elements', async ({ page }) => {
  await gotoGame(page);

  const cluster = page.locator('.player-cluster-floating');
  await expect(cluster).toBeVisible();

  const clusterBox = await cluster.boundingBox();
  expect(clusterBox).not.toBeNull();
  // In horizontal flex layout, width is significantly wider than height (not compressed into a narrow column)
  expect(clusterBox!.width).toBeGreaterThan(150);
  expect(clusterBox!.height).toBeLessThan(100);

  // All buttons inside the cluster are within the cluster's horizontal bounds
  const buttons = cluster.locator('button');
  const count = await buttons.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const btnBox = await buttons.nth(i).boundingBox();
    expect(btnBox).not.toBeNull();
    expect(btnBox!.x).toBeGreaterThanOrEqual(clusterBox!.x);
    expect(btnBox!.x + btnBox!.width).toBeLessThanOrEqual(clusterBox!.x + clusterBox!.width + 2);
  }
});

