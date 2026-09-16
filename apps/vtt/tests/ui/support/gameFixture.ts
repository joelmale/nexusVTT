import { test, expect, type Page } from '@playwright/test';

/**
 * Fixture that lands on the game canvas with no backend.
 *
 * The managed e2e stack (six containers, two browser contexts, backend
 * restarts) exists to prove multiplayer sync and durability. Panel layout,
 * z-order, focus handling and docking need none of it, so this suite stubs the
 * network and seeds the stores through the dev-only bridge
 * (`src/utils/testBridge.ts`) instead.
 */

export interface GameOptions {
  /** Panels to have open on arrival, in order. */
  panels?: string[];
  /** localStorage entries written before the app boots. */
  storage?: Record<string, unknown>;
  userType?: 'host' | 'player';
}

export const ROOM_CODE = 'TEST';

export async function gotoGame(
  page: Page,
  options: GameOptions = {},
): Promise<void> {
  const { panels = [], storage = {}, userType = 'host' } = options;

  // Nothing should reach a real backend. Fail loudly rather than hanging on a
  // 15s actionability timeout if something unexpected does.
  await page.route('**/api/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    }),
  );

  await page.addInitScript(
    ([seed, storageEntries]) => {
      // Consumed by installTestBridge() before the first React render, so
      // ProtectedRoute sees a session and never redirects to the lobby.
      (window as unknown as Record<string, unknown>).__TEST_SEED__ = seed;

      try {
        for (const [key, value] of Object.entries(
          storageEntries as Record<string, unknown>,
        )) {
          localStorage.setItem(key, JSON.stringify(value));
        }
      } catch {
        // Private mode / blocked storage - tests that need it will fail loudly.
      }
    },
    [
      { userName: 'UI Test DM', userType, roomCode: ROOM_CODE, activePanels: panels },
      storage,
    ] as const,
  );

  await page.goto(`/lobby/game/${ROOM_CODE}`);

  // The dock is the last chrome to settle, so it is the readiness signal.
  await expect(page.getByRole('tablist', { name: 'Panels' })).toBeVisible();
}

export { test, expect };
