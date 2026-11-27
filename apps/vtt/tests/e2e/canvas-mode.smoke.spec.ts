import { expect, test } from '@playwright/test';
import {
  createGuestHostSession,
  createGuestPlayerSession,
} from './support/flows';

test('DM Design stays local and Play fog and scene switches reach a connected player', async ({
  browser,
}) => {
  const viewport = { width: 1440, height: 900 };
  const host = await browser.newPage({ viewport });
  const player = await browser.newPage({ viewport });
  try {
    const { roomCode } = await createGuestHostSession(host);
    await createGuestPlayerSession(player, roomCode, 'Canvas Mode Player');

    const playerCanvas = player.locator('[data-role="scene-canvas-root"]');
    const playerDock = player.getByRole('toolbar', {
      name: 'Quick Tools Dock',
    });
    const scenePill = host.getByRole('region', { name: 'Scene Manager' });
    const mode = scenePill.getByRole('group', { name: 'Canvas mode' });
    const hostDock = host.getByRole('toolbar', { name: 'Quick Tools Dock' });
    const design = host.getByRole('toolbar', { name: 'Design tools' });

    await mode.getByRole('button', { name: 'Design', exact: true }).click();
    await expect(scenePill.getByText('Editing live scene')).toBeVisible();
    await expect(playerDock).toBeVisible();
    await expect(
      player.getByRole('group', { name: 'Canvas mode' }),
    ).toHaveCount(0);
    await design.getByRole('button', { name: 'Fog Setup' }).click();
    await design.getByRole('button', { name: 'Fog: Off' }).click();
    const playerFog = player.getByTestId('fog-layer-canvas');
    await expect(playerFog).toBeVisible();
    const centreOpacity = () =>
      playerFog.evaluate(
        (canvas: HTMLCanvasElement) =>
          canvas
            .getContext('2d')!
            .getImageData(
              Math.floor(canvas.width / 2),
              Math.floor(canvas.height / 2),
              1,
              1,
            ).data[3],
      );
    await expect.poll(centreOpacity).toBe(255);

    await mode.getByRole('button', { name: 'Play', exact: true }).click();
    await hostDock.getByRole('button', { name: 'Reveal Fog' }).click();
    await hostDock.getByRole('button', { name: 'Reveal Rect' }).click();
    const canvas = (await host
      .locator('[data-role="scene-canvas-root"]')
      .boundingBox())!;
    await host.mouse.move(
      canvas.x + canvas.width / 2 - 30,
      canvas.y + canvas.height / 2 - 30,
    );
    await host.mouse.down();
    await host.mouse.move(
      canvas.x + canvas.width / 2 + 30,
      canvas.y + canvas.height / 2 + 30,
      { steps: 4 },
    );
    await host.mouse.up();
    await expect.poll(centreOpacity).toBe(0);

    await mode.getByRole('button', { name: 'Design', exact: true }).click();
    await scenePill.hover();
    await scenePill.getByRole('button', { name: 'Create new scene' }).click();
    await expect(playerCanvas).toHaveAttribute('data-scene-name', 'Scene 2');
    await mode.getByRole('button', { name: 'Play', exact: true }).click();
    await scenePill.hover();
    await scenePill
      .getByRole('button', { name: 'Scene 1', exact: true })
      .click();
    await expect(playerCanvas).toHaveAttribute('data-scene-name', 'Scene 1');
    await expect(playerDock).toBeVisible();
  } finally {
    await Promise.all([host.close(), player.close()]);
  }
});
