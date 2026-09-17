import { test, expect, gotoGame } from './support/gameFixture';

/**
 * REGRESSION GUARD for a fixed renderer crash. These must stay green.
 *
 * Rapidly opening and closing panels used to kill the Chromium renderer
 * ("Target crashed" / EXCEPTION_BREAKPOINT, a Chromium-internal CHECK). It was
 * user-reachable: it reproduced in a headed browser window at human speed, not
 * only under automation, and it also took out the managed e2e smoke suite.
 *
 * CAUSE: every dock button rendered a `Tooltip`, and Tooltip.css declared the
 * same `anchor-name: --tooltip-anchor` on all of them. Many identically-named
 * CSS anchors in one tree, resolved while the tooltip was promoted to the top
 * layer via showPopover() and the dock was mid `max-width` transition, tripped
 * an invariant in Chromium's anchor-positioning code.
 *
 * FIX: Tooltip now portals into #portal-root and positions from the trigger's
 * getBoundingClientRect(). No anchor-name, no position-anchor, no anchor(), no
 * native popover. Confirmed by A/B: reverting only Tooltip.tsx/.css brings the
 * crash back 3/3 here, and restoring the fix makes all three pass.
 *
 * If these start failing, suspect CSS anchor positioning or top-layer promotion
 * returning to a component that renders once per item in a list. Do NOT mark
 * them skipped or expected-to-fail to get CI green -- that is what hid this bug
 * before, and test.fail() in particular reports a setup failure as a pass.
 */

const CYCLES = 20;

async function openDock(page: import('@playwright/test').Page) {
  await page.getByRole('tablist', { name: 'Panels' }).hover();
}

test.describe('panel open/close cycling', () => {
  // A renderer death usually surfaces as "Target crashed" on whatever action
  // ran next, which reads like an ordinary locator failure. Watch every test so
  // the report names the real cause, and fail even if the crash lands somewhere
  // that happens not to throw.
  let crashed = false;

  test.beforeEach(({ page }) => {
    crashed = false;
    page.on('crash', () => {
      crashed = true;
    });
  });

  test.afterEach(() => {
    expect(crashed, 'the Chromium renderer crashed during this test').toBe(
      false,
    );
  });

  test('survives 20 open/close cycles of a single panel', async ({ page }) => {
    await gotoGame(page);

    const tab = page.getByRole('tab', { name: 'Dice', exact: true });
    const panel = page.getByRole('dialog', { name: 'Dice', exact: true });

    let completed = 0;
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
      completed += 1;
    }

    // Still responsive: the renderer is alive and the store is coherent.
    await openDock(page);
    await expect(tab).toBeVisible();

    // Guards against a vacuous pass: if the dock ever stops being reachable the
    // loop can exit without exercising anything, and "no crash" would then mean
    // "no test".
    expect(completed, 'cycles actually exercised').toBe(CYCLES);
  });


  test('survives cycling several different panels', async ({ page }) => {
    await gotoGame(page);

    const names = ['Dice', 'Chat', 'Initiative', 'Tokens'];

    let completed = 0;
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
        completed += 1;
      }
    }

    await openDock(page);
    await expect(
      page.getByRole('tab', { name: 'Dice', exact: true }),
    ).toBeVisible();
    expect(completed, 'panel cycles actually exercised').toBe(5 * names.length);
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

    let completed = 0;
    for (let i = 0; i < 10; i += 1) {
      await cycle();
      completed += 1;
    }
    const after = await countNodes();

    expect(completed, 'leak-check cycles actually exercised').toBe(10);

    expect(
      after - baseline,
      `DOM grew by ${after - baseline} nodes over 10 identical cycles`,
    ).toBeLessThan(50);
  });
});
