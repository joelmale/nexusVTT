import path from 'node:path';
import {
  devices,
  expect,
  test,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
} from '@playwright/test';
import { createGuestHostSession, openPanel } from './support/flows';
import { hasManagedSmokeStack } from './support/stack';
import {
  observeWebSocketMessages,
  routeWebSocketsToBackend,
} from './support/websocket-observer';

/**
 * Simple Player Mode end to end, on a phone and on an iPad. The DM runs the
 * full VTT on desktop; the player joins from the DM's /play link. The player's
 * socket is pinned to the other backend replica, so every player intent has
 * to cross replicas (Redis fanout) to reach the DM's client and back.
 */

const CHARACTER = 'Aria Quickfoot';
const FIXTURE = path.join(
  process.cwd(),
  'tests',
  'e2e',
  'fixtures',
  'simple-player-character.json',
);

/** Device descriptors minus the browser choice: this project is Chromium. */
function deviceOptions(name: string): BrowserContextOptions {
  const options: BrowserContextOptions & { defaultBrowserType?: string } = {
    ...devices[name],
  };
  delete options.defaultBrowserType;
  return options;
}

const DEVICES = [
  { label: 'phone', device: 'iPhone 13', split: false },
  { label: 'iPad landscape', device: 'iPad Pro 11 landscape', split: true },
] as const;

function hostCard(page: Page) {
  return page.locator('.character-card').filter({ hasText: CHARACTER });
}

function hostToken(page: Page, playerName: string) {
  return page.locator(`[data-token-name="${playerName}"]`);
}

async function importPartyCharacter(hostPage: Page): Promise<void> {
  await openPanel(hostPage, 'Characters');
  await hostPage.getByRole('button', { name: /Import/ }).click();
  await hostPage
    .locator('input[type="file"][accept=".json"]')
    .setInputFiles(FIXTURE);
  await hostPage.getByRole('button', { name: 'Import 1 Character' }).click();
  await expect(hostCard(hostPage)).toBeVisible();
}

async function showPlayerPanel(
  page: Page,
  split: boolean,
  tab: 'Map' | 'My Hero' | 'Rolls',
): Promise<void> {
  if (split) {
    if (tab !== 'Map') await page.getByRole('tab', { name: tab }).click();
    return;
  }
  await page
    .getByRole('navigation', { name: 'Simple mode' })
    .getByRole('button', { name: tab })
    .click();
}

test.describe.configure({ mode: 'serial' });

for (const { label, device, split } of DEVICES) {
  test(`simple player mode on a ${label}: join, claim, HP, dice, move, reconnect`, async ({
    browser,
  }) => {
    test.skip(
      !hasManagedSmokeStack(),
      'Simple Player Mode needs the managed stack: npm run test:e2e.',
    );
    test.setTimeout(180_000);

    const backendUrl = process.env.E2E_BACKEND_URL ?? 'http://127.0.0.1:15001';
    const backendPeerUrl =
      process.env.E2E_BACKEND_PEER_URL ?? 'http://127.0.0.1:15002';
    const playerName = `Mia ${label} ${Date.now()}`;
    const contexts: BrowserContext[] = [];

    try {
      const hostContext = await browser.newContext({
        viewport: { width: 1920, height: 1000 },
      });
      const playerContext = await browser.newContext(deviceOptions(device));
      contexts.push(hostContext, playerContext);
      const hostPage = await hostContext.newPage();
      const playerPage = await playerContext.newPage();
      await routeWebSocketsToBackend(hostPage, backendUrl);
      await routeWebSocketsToBackend(playerPage, backendPeerUrl);
      const playerSockets = await observeWebSocketMessages(playerPage);

      // DM: create the game, check the invite card, prepare a character.
      const { roomCode } = await createGuestHostSession(hostPage);
      await openPanel(hostPage, 'Lobby');
      await expect(
        hostPage.getByRole('img', { name: 'QR code for the player link' }),
      ).toBeVisible();
      const inviteUrl = await hostPage
        .getByRole('textbox', { name: 'Simple player link' })
        .inputValue();
      expect(new URL(inviteUrl).pathname).toBe(`/play/${roomCode}`);
      await importPartyCharacter(hostPage);

      // Player: open the invite link and join with just a name.
      await playerPage.goto(new URL(inviteUrl).pathname);
      await playerPage.getByLabel('Your name').fill(playerName);
      await playerPage.getByRole('button', { name: 'Join game' }).click();
      await expect(playerPage).toHaveURL(
        new RegExp(`/lobby/game/${roomCode}$`),
      );
      await expect(playerPage.getByTestId('simple-player-shell')).toBeVisible();
      if (split) {
        await expect(
          playerPage.getByRole('complementary', { name: 'Side panel' }),
        ).toBeVisible();
      } else {
        await expect(
          playerPage.getByRole('navigation', { name: 'Simple mode' }),
        ).toBeVisible();
      }

      // Claim the DM's character: an intent to the DM's client, then the DM's
      // published state comes back and fills the player's ribbon.
      await playerPage
        .getByRole('button', { name: new RegExp(`Play as ${CHARACTER}`) })
        .click();
      await expect(
        playerPage.getByRole('dialog', { name: 'Choose your character' }),
      ).toBeHidden();
      const ribbon = playerPage.getByTestId('simple-ribbon');
      await expect(ribbon).toContainText(CHARACTER);
      await expect(
        ribbon.getByRole('status', { name: 'Connected' }),
      ).toBeVisible();

      // HP from the phone reaches the DM's sheet.
      await ribbon.getByRole('button', { name: /Hit points 24 of 30/ }).click();
      await ribbon.getByRole('button', { name: '-5', exact: true }).click();
      await expect(
        ribbon.getByRole('button', { name: /Hit points 19 of 30/ }),
      ).toBeVisible();
      await expect(hostCard(hostPage).locator('.hp-current')).toHaveText(/19/);

      // A sheet roll with advantage, and a dice-pad roll, both reach the DM.
      await openPanel(hostPage, 'Dice');
      await showPlayerPanel(playerPage, split, 'My Hero');
      await playerPage
        .getByRole('radio', { name: 'Advantage', exact: true })
        .click();
      await playerPage.getByRole('tab', { name: 'Skills & Saves' }).click();
      await playerPage.getByRole('button', { name: 'Stealth +5' }).click();
      await expect(
        hostPage.getByTestId('dice-log-entry').filter({ hasText: '1d20+5' }),
      ).toHaveCount(1);

      await showPlayerPanel(playerPage, split, 'Rolls');
      await playerPage.getByRole('button', { name: 'Add d8' }).click();
      await playerPage.getByRole('button', { name: 'Add d8' }).click();
      await playerPage.getByRole('button', { name: 'Roll 2d8' }).click();
      await expect(
        hostPage.getByTestId('dice-log-entry').filter({ hasText: '2d8' }),
      ).toHaveCount(1);
      await hostPage
        .getByRole('dialog', { name: 'Dice' })
        .getByRole('button', { name: 'Close panel' })
        .click();

      // Tap-to-move: the token moves on the DM's map only after Confirm.
      await showPlayerPanel(playerPage, split, 'Map');
      const token = hostToken(hostPage, playerName);
      await expect(token).toHaveCount(1);
      const before = await token.getAttribute('transform');
      await playerPage.getByRole('button', { name: 'Move My Token' }).click();
      const canvas = playerPage.locator('[data-role="scene-canvas-root"]');
      const box = await canvas.boundingBox();
      if (!box) throw new Error('Player map has no bounds.');
      await canvas.tap({
        position: { x: box.width * 0.75, y: box.height * 0.3 },
      });
      await expect(playerPage.getByText(/Move here — \d+ ft/)).toBeVisible();
      expect(await token.getAttribute('transform')).toBe(before);
      await playerPage.getByRole('button', { name: 'Confirm Move' }).click();
      await expect.poll(() => token.getAttribute('transform')).not.toBe(before);

      // Losing the network (as when iOS backgrounds the tab for a video
      // call) and coming back resumes without a "session expired" bounce,
      // and intents work again afterwards.
      await playerSockets.disconnect();
      await expect(
        ribbon.getByRole('status', { name: /Reconnecting|Offline/ }),
      ).toBeVisible({ timeout: 20_000 });
      playerSockets.reconnect();
      await playerPage.evaluate(() => {
        document.dispatchEvent(new Event('visibilitychange'));
        window.dispatchEvent(new Event('pageshow'));
      });
      await expect(
        ribbon.getByRole('status', { name: 'Connected' }),
      ).toBeVisible({ timeout: 30_000 });
      await expect(playerPage.getByText('Session expired')).toHaveCount(0);
      await expect(playerPage).toHaveURL(
        new RegExp(`/lobby/game/${roomCode}$`),
      );

      const hpToggle = ribbon.getByRole('button', {
        name: /Hit points 19 of 30/,
      });
      if ((await hpToggle.getAttribute('aria-expanded')) !== 'true')
        await hpToggle.click();
      await ribbon.getByRole('button', { name: '+1', exact: true }).click();
      await expect(hostCard(hostPage).locator('.hp-current')).toHaveText(/20/);
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
}
