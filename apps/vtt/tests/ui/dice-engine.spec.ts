import { test, expect, gotoGame } from './support/gameFixture';

/**
 * DiceBox3D used to boot two Babylon engines on every page load: the init guard
 * checked `diceBoxRef.current`, which is only assigned after `await init()`, so
 * both of StrictMode's dev effect invocations passed it. Two WebGL2 contexts,
 * two render loops.
 *
 * This asserts the engine is created exactly once and leaves a single canvas.
 */
test.describe('3D dice engine lifecycle', () => {
  test('initialises exactly one Babylon engine per page load', async ({
    page,
  }) => {
    const consoleLines: string[] = [];
    page.on('console', (message) => consoleLines.push(message.text()));

    await gotoGame(page);

    // init() resolving is what emits the Babylon banner, so wait for the
    // success log rather than for the canvas (which the constructor creates).
    await expect
      .poll(
        () =>
          consoleLines.filter((line) =>
            line.includes('DiceBox initialized successfully'),
          ).length,
        { message: 'DiceBox never finished initialising', timeout: 30_000 },
      )
      .toBeGreaterThan(0);

    // A second engine starts a beat behind the first, so give it a chance to
    // announce itself before counting.
    await page.waitForTimeout(2_000);

    const initCalls = consoleLines.filter((line) =>
      line.includes('Calling diceBox.init()'),
    );
    const engineBanners = consoleLines.filter((line) =>
      line.includes('Babylon.js'),
    );

    expect(
      initCalls,
      `init() calls: ${JSON.stringify(initCalls)}`,
    ).toHaveLength(1);
    expect(
      engineBanners,
      `Babylon banners: ${JSON.stringify(engineBanners)}`,
    ).toHaveLength(1);
    await expect(page.locator('#dice-box canvas')).toHaveCount(1);
  });
  test('still rolls dice after the single-init fix', async ({ page }) => {
    const consoleLines: string[] = [];
    page.on('console', (message) => consoleLines.push(message.text()));

    await gotoGame(page);

    await expect
      .poll(
        () =>
          consoleLines.filter((line) =>
            line.includes('DiceBox initialized successfully'),
          ).length,
        { message: 'DiceBox never finished initialising', timeout: 30_000 },
      )
      .toBeGreaterThan(0);

    // Push a server-shaped roll straight into the store, the same way an
    // incoming `dice/roll-result` event would.
    await page.evaluate(() => {
      const store = (
        window as unknown as {
          __gameStore: {
            setState: (updater: (state: unknown) => unknown) => void;
          };
        }
      ).__gameStore;

      store.setState((state) => {
        const previous = state as { diceRolls: unknown[] };
        return {
          ...previous,
          diceRolls: [
            {
              id: 'ui-test-roll',
              userId: 'ui-test-user',
              userName: 'UI Test DM',
              expression: '2d20',
              pools: [{ count: 2, sides: 20, results: [17, 4] }],
              modifier: 0,
              results: [17, 4],
              total: 21,
              timestamp: Date.now(),
            },
            ...previous.diceRolls,
          ],
        };
      });
    });

    await expect
      .poll(
        () =>
          consoleLines.filter((line) =>
            line.includes('Roll animation complete'),
          ).length,
        { message: 'the dice never finished rolling', timeout: 30_000 },
      )
      .toBeGreaterThan(0);
  });
});
