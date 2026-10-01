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

/**
 * A point inside both panels. Panels open anchored to the right edge, so the
 * overlap starts at the right-most left edge and the lower top edge - not at a
 * fixed offset from either panel, which breaks whenever a panel's width changes.
 */
async function overlapPoint(page: import('@playwright/test').Page) {
  const chatBox = await page.getByRole('dialog', { name: 'Chat', exact: true }).boundingBox();
  const diceBox = await page.getByRole('dialog', { name: 'Dice', exact: true }).boundingBox();
  expect(chatBox).not.toBeNull();
  expect(diceBox).not.toBeNull();
  return {
    x: Math.max(chatBox!.x, diceBox!.x) + 50,
    y: Math.max(chatBox!.y, diceBox!.y) + 50,
  };
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

  const overlap = await overlapPoint(page);

  // In the overlap region, Dice is on top before Chat is clicked
  expect(await panelAtPoint(page, overlap.x, overlap.y)).toBe('Dice');

  // Title bar: past the 12px corner resize handle, left of the action buttons.
  await chat.click({ position: { x: 60, y: 18 } });

  // Now Chat should be on top in the overlap region!
  expect(await panelAtPoint(page, overlap.x, overlap.y)).toBe('Chat');
});

test('clicking the body of a buried panel raises it above the others', async ({ page }) => {
  await gotoGame(page);

  await openPanel(page, 'Chat');
  await openPanel(page, 'Dice');

  const chat = page.getByRole('dialog', { name: 'Chat', exact: true });
  const overlap = await overlapPoint(page);

  // Chat's right edge sticks out past Dice (both are right-anchored; Dice is cascaded inward).
  // Click on Chat's body in the visible sticking-out area.
  const chatBox = await chat.boundingBox();
  expect(chatBox).not.toBeNull();

  // Click on Chat body (e.g. y = 150, near right edge of Chat)
  const clickX = chatBox!.x + chatBox!.width - 10;
  const clickY = chatBox!.y + 150;
  expect(await panelAtPoint(page, clickX, clickY)).toBe('Chat');

  await page.mouse.click(clickX, clickY);

  // Now Chat should be on top in the overlap region
  expect(await panelAtPoint(page, overlap.x, overlap.y)).toBe('Chat');
});

test('clicking the dock tab of an already-open buried panel brings it to the front without closing it', async ({ page }) => {
  await gotoGame(page);

  await openPanel(page, 'Chat');
  await openPanel(page, 'Dice');

  const overlap = await overlapPoint(page);

  // Dice is on top in overlap region
  expect(await panelAtPoint(page, overlap.x, overlap.y)).toBe('Dice');

  // Click Chat in the dock
  await page.getByRole('tablist', { name: 'Panels' }).hover();
  await page.getByRole('tab', { name: 'Chat', exact: true }).click();

  // Chat should STILL be open!
  await expect(page.getByRole('dialog', { name: 'Chat', exact: true })).toBeVisible();

  // And Chat should now be on top in the overlap region!
  expect(await panelAtPoint(page, overlap.x, overlap.y)).toBe('Chat');
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

