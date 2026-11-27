import {
  CANVAS_TOKEN_ID,
  seedCanvasScene,
  selectedCanvasObjects,
  type CanvasTestWindow,
} from './support/canvasFixture';
import { expect, gotoGame, test } from './support/gameFixture';

test('draw, move, resize, and delete a spell effect', async ({ page }) => {
  await gotoGame(page);
  const dock = page.getByRole('toolbar', { name: 'Quick Tools Dock' });
  await dock.getByRole('button', { name: 'Spells', exact: true }).click();
  await dock.getByRole('button', { name: 'Sphere', exact: true }).click();

  const surface = (await page
    .locator('[data-role="scene-canvas-root"]')
    .boundingBox())!;
  const x = surface.x + surface.width * 0.35;
  const y = surface.y + surface.height * 0.48;
  const drag = async (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ) => {
    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    await page.mouse.move(toX, toY, { steps: 5 });
    await page.mouse.up();
  };
  await drag(x, y, x + 75, y);

  const panel = page.getByRole('dialog', { name: 'Spell effect properties' });
  const circle = page.locator('circle.drawing-spell-circle');
  const handle = page.locator('.selection-handle').first();
  await expect(panel).toBeVisible();
  await expect(handle).toBeVisible();

  // Deselect, then start moving directly on the spell surface.
  await panel.getByRole('button', { name: 'Close properties' }).click();
  const box = (await circle.boundingBox())!;
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const startX = Number(await circle.getAttribute('cx'));
  await drag(center.x, center.y, center.x + 40, center.y + 30);
  await expect
    .poll(async () => Number(await circle.getAttribute('cx')))
    .toBeGreaterThan(startX);

  const radius = Number(await circle.getAttribute('r'));
  const grip = (await handle.boundingBox())!;
  const gripX = grip.x + grip.width / 2;
  const gripY = grip.y + grip.height / 2;
  await drag(gripX, gripY, gripX + 40, gripY);
  await expect
    .poll(async () => Number(await circle.getAttribute('r')))
    .toBeGreaterThan(radius);

  await panel.getByRole('button', { name: 'Delete spell effect' }).click();
  await expect(circle).toHaveCount(0);
  await expect(panel).toHaveCount(0);
});

test('fog paint captures input only while a fog tool is active', async ({
  page,
}) => {
  await gotoGame(page);
  await seedCanvasScene(page);

  const token = page.locator(`[data-token-id="${CANVAS_TOKEN_ID}"] image`);
  const fog = page.getByTestId('fog-layer-canvas');
  const capture = page.locator('.fog-tool-layer rect').first();
  await expect(fog).toBeVisible();
  await expect(token).toBeVisible();
  await expect(capture).toHaveCount(0);

  const box = (await token.boundingBox())!;
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const hitLayer = (selector: string) =>
    page.evaluate(
      ({ x, y, selector }) =>
        !!document.elementFromPoint(x, y)?.closest(selector),
      { ...centre, selector },
    );
  await expect.poll(() => hitLayer('.drawing-tools')).toBe(true);
  await page.getByRole('button', { name: 'Reveal Fog', exact: true }).click();
  await page.getByRole('button', { name: 'Reveal Rect', exact: true }).click();
  await expect(capture).toBeVisible();
  expect(await hitLayer('.fog-tool-layer')).toBe(true);

  await page.mouse.move(centre.x - 15, centre.y - 15);
  await page.mouse.down();
  await page.mouse.move(centre.x + 15, centre.y + 15, { steps: 3 });
  await page.mouse.up();
  await expect
    .poll(() =>
      fog.evaluate((canvas: HTMLCanvasElement) => {
        const context = canvas.getContext('2d')!;
        const y = Math.floor(canvas.height / 2);
        return [
          context.getImageData(Math.floor(canvas.width / 2), y, 1, 1).data[3],
          context.getImageData(Math.floor(canvas.width / 4), y, 1, 1).data[3],
        ];
      }),
    )
    .toEqual([0, 128]);

  await page
    .getByRole('button', { name: 'Select / Move', exact: true })
    .click();
  await expect(capture).toHaveCount(0);
  await expect.poll(() => hitLayer('.drawing-tools')).toBe(true);
  await page.mouse.click(centre.x, centre.y);
  await expect
    .poll(() => selectedCanvasObjects(page))
    .toEqual([CANVAS_TOKEN_ID]);
});

for (const gesture of ['wheel pan', 'wheel zoom', 'pinch'] as const) {
  test(`player fog stays opaque and aligned during ${gesture}`, async ({
    page,
  }) => {
    await gotoGame(page, { userType: 'player' });
    await seedCanvasScene(page, true);
    await expect(page.getByTestId('fog-layer-canvas')).toBeVisible();

    const samples = await page.evaluate(async (gesture) => {
      const svg = document.querySelector<SVGSVGElement>(
        '[data-role="scene-canvas-root"]',
      )!;
      const world = svg.querySelector<SVGGElement>('g.scene-content')!;
      const canvas = svg.querySelector<HTMLCanvasElement>(
        '[data-testid="fog-layer-canvas"]',
      )!;
      const context = canvas.getContext('2d')!;
      const viewport = svg.getBoundingClientRect();
      const original = world.getAttribute('transform');
      const x = viewport.left + viewport.width / 2;
      const y = viewport.top + viewport.height / 2;

      if (gesture === 'pinch') {
        const touch = (id: number, clientX: number) =>
          new Touch({ identifier: id, target: svg, clientX, clientY: y });
        svg.dispatchEvent(
          new TouchEvent('touchstart', {
            touches: [touch(1, x - 180), touch(2, x + 180)],
            cancelable: true,
          }),
        );
        svg.dispatchEvent(
          new TouchEvent('touchmove', {
            touches: [touch(1, x - 80), touch(2, x + 120)],
            cancelable: true,
          }),
        );
      } else {
        svg.dispatchEvent(
          new WheelEvent('wheel', {
            clientX: x,
            clientY: y,
            cancelable: true,
            deltaX: gesture === 'wheel pan' ? -270 : 0,
            deltaY: gesture === 'wheel zoom' ? 160 : 0,
            ctrlKey: gesture === 'wheel zoom',
          }),
        );
      }

      // Read on the next animation frame, while the gesture has not committed.
      const result = await new Promise<{
        moved: boolean;
        alphas: number[];
      }>((resolve) =>
        requestAnimationFrame(() => {
          const rect = canvas.getBoundingClientRect();
          const alphaAt = ({ x, y }: { x: number; y: number }) => {
            const px = Math.floor(
              ((x - rect.left) * canvas.width) / rect.width,
            );
            const py = Math.floor(
              ((y - rect.top) * canvas.height) / rect.height,
            );
            return context.getImageData(px, py, 1, 1).data[3];
          };
          const matrix = world.getScreenCTM()!;
          resolve({
            moved: world.getAttribute('transform') !== original,
            alphas: [
              alphaAt({ x: viewport.left + 3, y: viewport.top + 3 }),
              alphaAt({ x: viewport.right - 3, y: viewport.bottom - 3 }),
              alphaAt(new DOMPoint(0, 0).matrixTransform(matrix)),
              alphaAt(new DOMPoint(65, 0).matrixTransform(matrix)),
            ],
          });
        }),
      );
      if (gesture === 'pinch') svg.dispatchEvent(new TouchEvent('touchend'));
      return result;
    }, gesture);

    expect(samples.moved).toBe(true);
    expect(samples.alphas).toEqual([255, 255, 0, 255]);
  });
}

test.describe('high-density player viewport', () => {
  test.use({ deviceScaleFactor: 2 });

  test('keeps fog fitted after resize and clears old reveals on scene change', async ({
    page,
  }) => {
    await gotoGame(page, { userType: 'player' });
    await seedCanvasScene(page, true);

    const canvas = page.getByTestId('fog-layer-canvas');
    const sample = () =>
      canvas.evaluate((mask: HTMLCanvasElement) => {
        const bounds = mask.getBoundingClientRect();
        const viewport = mask.closest('svg')!.getBoundingClientRect();
        const context = mask.getContext('2d')!;
        const center = context.getImageData(
          mask.width / 2,
          mask.height / 2,
          1,
          1,
        ).data[3];
        const edge = context.getImageData(mask.width - 1, mask.height - 1, 1, 1)
          .data[3];
        return {
          coversViewport:
            Math.abs(bounds.width - viewport.width) < 1 &&
            Math.abs(bounds.height - viewport.height) < 1,
          density: mask.width / Math.round(viewport.width),
          center,
          edge,
        };
      });

    const revealed = { coversViewport: true, density: 2, center: 0, edge: 255 };
    await expect.poll(sample).toEqual(revealed);
    await page.setViewportSize({ width: 900, height: 640 });
    await expect.poll(sample).toEqual(revealed);

    await page.evaluate(() => {
      const store = (window as unknown as CanvasTestWindow).__gameStore;
      const { sceneState } = store.getState();
      const next = {
        ...sceneState.scenes[0]!,
        id: 'unrevealed-scene',
        fog: { enabled: true, shapes: [] },
      };
      store.setState({
        sceneState: {
          ...sceneState,
          scenes: [...sceneState.scenes, next],
          activeSceneId: next.id,
        },
      });
    });
    await expect.poll(sample).toEqual({ ...revealed, center: 255 });
  });
});
