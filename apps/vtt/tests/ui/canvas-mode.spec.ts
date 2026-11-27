import type { Page } from '@playwright/test';
import {
  seedCanvasScene,
  type CanvasTestWindow,
} from './support/canvasFixture';
import { expect, gotoGame, test } from './support/gameFixture';

function getCanvasState(page: Page) {
  return page.evaluate(() => {
    const { activeSceneId, activeTool, camera, scenes } = (
      window as unknown as CanvasTestWindow
    ).__gameStore.getState().sceneState;
    return {
      activeSceneId,
      activeTool,
      camera,
      revealCount: scenes.find((scene) => scene.id === activeSceneId)?.fog
        ?.shapes.length,
    };
  });
}

test('host can design on the shared scene and resume Play without moving the camera', async ({
  page,
}) => {
  await gotoGame(page);
  await seedCanvasScene(page);
  const dock = page.getByRole('toolbar', { name: 'Quick Tools Dock' });
  const mode = page.getByRole('group', { name: 'Canvas mode' });
  await expect(mode.getByRole('button', { name: 'Play' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  const initialZoom = (await getCanvasState(page)).camera.zoom;
  await dock.getByRole('button', { name: 'Zoom In' }).click();
  await expect
    .poll(async () => (await getCanvasState(page)).camera.zoom)
    .toBeCloseTo(initialZoom * 1.2);
  const before = await getCanvasState(page);
  await dock.getByRole('button', { name: 'Reveal Fog' }).press('Enter');
  await expect(
    dock.getByRole('button', { name: 'Reveal Brush' }),
  ).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(dock.getByRole('button', { name: 'Reveal Rect' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    dock.getByRole('button', { name: 'Reveal Brush' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dock.getByLabel('Active tool')).toHaveText('Reveal Brush');
  await expect(dock.getByRole('button', { name: 'Reveal Brush' })).toBeHidden();

  const canvas = (await page
    .locator('[data-role="scene-canvas-root"]')
    .boundingBox())!;
  await page.mouse.move(canvas.x + 200, canvas.y + 200);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 240, canvas.y + 240, { steps: 3 });
  await mode.getByRole('button', { name: 'Design' }).press('Enter');
  await page.mouse.up();

  const design = page.getByRole('toolbar', { name: 'Design tools' });
  await expect(design).toBeVisible();
  await expect(page.getByText('Editing live scene')).toBeVisible();
  await expect
    .poll(async () => (await getCanvasState(page)).revealCount)
    .toBe(0);
  await design.getByRole('button', { name: 'Scene Properties' }).click();
  await expect(
    page.getByRole('tab', { name: 'General', exact: true }),
  ).toBeVisible();
  await design.getByRole('button', { name: 'Grid Alignment' }).click();
  await expect(design.getByLabel('Active tool')).toHaveText('Grid Alignment');
  await mode.getByRole('button', { name: 'Play' }).click();
  await expect(dock.getByLabel('Active tool')).toHaveText('Select / Move');
  await expect(
    dock.getByRole('button', { name: 'Grid Alignment' }),
  ).toBeHidden();
  expect(await getCanvasState(page)).toEqual(before);
});

test.describe('touch player dock', () => {
  test.use({ hasTouch: true, viewport: { width: 760, height: 640 } });

  test('opens a labeled tool popover and shows the active tool after selection', async ({
    page,
  }) => {
    await gotoGame(page, { userType: 'player', uiMode: 'full' });
    const dock = page.getByRole('toolbar', { name: 'Quick Tools Dock' });
    await expect(page.getByRole('group', { name: 'Canvas mode' })).toHaveCount(
      0,
    );
    await expect(dock.getByRole('button', { name: 'Reveal Fog' })).toHaveCount(
      0,
    );
    await dock.getByRole('button', { name: 'Spells' }).tap();
    await dock.getByRole('button', { name: 'Sphere' }).tap();
    await expect(dock.getByLabel('Active tool')).toHaveText('Spell: Sphere');
    await expect(dock.getByRole('button', { name: 'Sphere' })).toBeHidden();
  });
});
