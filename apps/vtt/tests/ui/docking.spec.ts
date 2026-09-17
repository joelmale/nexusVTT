import { test, expect, gotoGame } from './support/gameFixture';
import { canvasRect, gameLayoutGrid } from './support/layoutProbes';

/**
 * Docking reserves real layout space, so the assertions are about resolved
 * grid tracks and the canvas actually shrinking - neither of which exists in
 * jsdom.
 */

async function openPanel(page: import('@playwright/test').Page, name: string) {
  await page.getByRole('tablist', { name: 'Panels' }).hover();
  await page.getByRole('tab', { name, exact: true }).click();
  await expect(page.getByRole('dialog', { name, exact: true })).toBeVisible();
}

test('an undocked layout reserves no space', async ({ page }) => {
  await gotoGame(page);

  const grid = await gameLayoutGrid(page);
  // Side tracks collapse to 0px when nothing is docked.
  expect(grid.columns).toMatch(/^0px .* 0px$/);
});

test('a panel docked to an edge opens a grid track and shrinks the canvas', async ({ page }) => {
  await gotoGame(page);
  const before = await canvasRect(page);
  expect(before).not.toBeNull();

  await openPanel(page, 'Dice');

  // Drag the panel's title bar to the left edge to dock it.
  const panel = page.getByRole('dialog', { name: 'Dice', exact: true });
  const box = await panel.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box!.x + 60, box!.y + 18);
  await page.mouse.down();
  await page.mouse.move(400, 400, { steps: 10 });
  await page.mouse.move(10, 400, { steps: 10 });
  await page.mouse.up();

  await expect
    .poll(async () => (await gameLayoutGrid(page)).columns)
    .not.toMatch(/^0px/);

  const after = await canvasRect(page);
  expect(after!.width).toBeLessThan(before!.width);
  expect(after!.left).toBeGreaterThan(before!.left);

  // The dock region actually hosts the panel.
  await expect(
    page.locator('[data-dock-region="left"] [role="dialog"]'),
  ).toHaveCount(1);
});

test('cursor-anchored zoom still anchors correctly with a dock offset', async ({ page }) => {
  // The specific risk called out for item 7: if the canvas reflow does not
  // feed back into the gesture engine's viewport rect, zoom keeps anchoring on
  // pre-dock dimensions and the point under the cursor drifts.
  await gotoGame(page);
  await openPanel(page, 'Dice');

  const panel = page.getByRole('dialog', { name: 'Dice', exact: true });
  const box = await panel.boundingBox();
  await page.mouse.move(box!.x + 60, box!.y + 18);
  await page.mouse.down();
  await page.mouse.move(400, 400, { steps: 10 });
  await page.mouse.move(10, 400, { steps: 10 });
  await page.mouse.up();

  await expect
    .poll(async () => (await gameLayoutGrid(page)).columns)
    .not.toMatch(/^0px/);

  const drift = await page.evaluate(async () => {
    const svg = document.querySelector('[data-role="scene-canvas-root"]')!;
    const r = svg.getBoundingClientRect();
    // A point deliberately off-centre, so centre-anchored maths would fail.
    const cx = r.left + r.width * 0.3;
    const cy = r.top + r.height * 0.7;

    const worldAt = () => {
      const g = document.querySelector('g.scene-content') as SVGGElement | null;
      if (!g) return null;
      const m = g.getScreenCTM();
      if (!m) return null;
      const pt = new DOMPoint(cx, cy).matrixTransform(m.inverse());
      return { x: pt.x, y: pt.y };
    };

    const before = worldAt();
    svg.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -300, ctrlKey: true, clientX: cx, clientY: cy,
        bubbles: true, cancelable: true,
      }),
    );
    await new Promise((r2) => setTimeout(r2, 300));
    const after = worldAt();
    if (!before || !after) return null;
    return { dx: Math.abs(after.x - before.x), dy: Math.abs(after.y - before.y) };
  });

  expect(drift).not.toBeNull();
  expect(drift!.dx).toBeLessThan(1);
  expect(drift!.dy).toBeLessThan(1);
});

test('undocking releases the track and restores the canvas', async ({ page }) => {
  await gotoGame(page);
  const before = await canvasRect(page);

  await openPanel(page, 'Dice');
  const panel = page.getByRole('dialog', { name: 'Dice', exact: true });
  const box = await panel.boundingBox();
  await page.mouse.move(box!.x + 60, box!.y + 18);
  await page.mouse.down();
  await page.mouse.move(400, 400, { steps: 10 });
  await page.mouse.move(10, 400, { steps: 10 });
  await page.mouse.up();

  await expect
    .poll(async () => (await gameLayoutGrid(page)).columns)
    .not.toMatch(/^0px/);

  await page.getByRole('button', { name: 'Undock panel' }).click();

  await expect
    .poll(async () => (await gameLayoutGrid(page)).columns)
    .toMatch(/^0px/);

  const after = await canvasRect(page);
  expect(after!.width).toBe(before!.width);
});
