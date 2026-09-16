import { test, expect, gotoGame } from './support/gameFixture';

/**
 * KNOWN FAILING - these reproduce a live bug and are marked `test.fail()`.
 * When it is fixed they will "fail" by passing, which is the signal to delete
 * the annotation.
 *
 * They isolate the `Target crashed` renderer death that the managed e2e smoke
 * suite hits. It reproduces on a clean checkout of `main`, so it predates the
 * panel work. There it took ~4 minutes and a two-client multiplayer stack to
 * surface once; here it reproduces on a single page with no backend in about
 * ten seconds, which is the point of this suite.
 *
 * WHAT IS KNOWN (from instrumenting these):
 *   - NOT a memory leak. Death comes on cycle 1-2 with the heap at ~69MB and
 *     ~650 DOM nodes, and the node/canvas counts stay flat across cycles.
 *   - It is the GPU/renderer process, not JS. Console shows two distinct
 *     `[.WebGL-0x…]` contexts and "GPU stall due to ReadPixels" beforehand.
 *   - Timing-sensitive: at ~200ms between interactions it survives 5+ cycles;
 *     at 0/30/100ms it dies almost immediately. That is still within
 *     human-reachable speed, so this is not purely a harness artifact.
 *
 * WHAT WAS RULED OUT:
 *   - DiceBox3D initialisation racing the churn: waiting for it to fully
 *     settle before cycling does not help.
 *   - The visible canvases: releasing every retrievable WebGL context and
 *     removing all <canvas> elements before cycling does not help (and those
 *     two canvases expose no retrievable context, so they are not the ones in
 *     the console messages).
 *   - Panel mount/unmount accumulation: counts are flat.
 *
 * Next step would be `chrome://gpu` / CDP `Browser.getWindowBounds` tracing or
 * a `--disable-gpu` run to confirm whether it is a SwiftShader/driver issue in
 * this container rather than application code.
 */

const CYCLES = 20;

async function openDock(page: import('@playwright/test').Page) {
  await page.getByRole('tablist', { name: 'Panels' }).hover();
}

test.describe('panel open/close cycling', () => {
  test.fail(true, 'renderer/GPU process crashes on rapid panel cycling - cause not yet identified');

  test('survives 20 open/close cycles of a single panel', async ({ page }) => {
    await gotoGame(page);

    const tab = page.getByRole('tab', { name: 'Dice', exact: true });
    const panel = page.getByRole('dialog', { name: 'Dice', exact: true });

    for (let i = 0; i < CYCLES; i += 1) {
      await openDock(page);
      await tab.click();
      await expect(panel, `panel should be open on cycle ${i + 1}`).toBeVisible();

      await openDock(page);
      await tab.click();
      await expect(
        panel,
        `panel should be closed on cycle ${i + 1}`,
      ).toHaveCount(0);
    }

    // Still responsive: the renderer is alive and the store is coherent.
    await openDock(page);
    await expect(tab).toBeVisible();
  });

  test('survives cycling several different panels', async ({ page }) => {
    await gotoGame(page);

    const names = ['Dice', 'Chat', 'Initiative', 'Tokens'];

    for (let round = 0; round < 5; round += 1) {
      for (const name of names) {
        const tab = page.getByRole('tab', { name, exact: true });
        await openDock(page);
        await tab.click();
        await expect(
          page.getByRole('dialog', { name, exact: true }),
          `${name} open, round ${round + 1}`,
        ).toBeVisible();

        await openDock(page);
        await tab.click();
      }
    }

    await openDock(page);
    await expect(
      page.getByRole('tab', { name: 'Dice', exact: true }),
    ).toBeVisible();
  });

  test('does not leak detached panel nodes across cycles', async ({ page }) => {
    // A steadily growing DOM across identical cycles is the signature of the
    // leak that would explain an out-of-memory renderer crash.
    await gotoGame(page);

    const tab = page.getByRole('tab', { name: 'Chat', exact: true });
    const countNodes = () =>
      page.evaluate(() => document.getElementsByTagName('*').length);

    const cycle = async () => {
      await openDock(page);
      await tab.click();
      await expect(
        page.getByRole('dialog', { name: 'Chat', exact: true }),
      ).toBeVisible();
      await openDock(page);
      await tab.click();
      await expect(
        page.getByRole('dialog', { name: 'Chat', exact: true }),
      ).toHaveCount(0);
    };

    // Warm up so lazy chunks and one-time DOM are already paid for.
    await cycle();
    await cycle();
    const baseline = await countNodes();

    for (let i = 0; i < 10; i += 1) await cycle();
    const after = await countNodes();

    expect(
      after - baseline,
      `DOM grew by ${after - baseline} nodes over 10 identical cycles`,
    ).toBeLessThan(50);
  });
});
