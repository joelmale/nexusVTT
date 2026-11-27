import { favoriteOrListedPanel, panelsDock } from '../../support/panelDock';
import { expect, type Page, type WebSocket } from '@playwright/test';

export interface HostSession {
  roomCode: string;
  webSocket: WebSocket;
}

export interface PlayerSession {
  roomCode: string;
  webSocket: WebSocket;
}

export async function createGuestHostSession(page: Page): Promise<HostSession> {
  await page.goto('/lobby');
  await expect(page.getByRole('heading', { name: 'Nexus VTT' })).toBeVisible();

  // The heading also exists in the no-JavaScript loading skeleton. Waiting for
  // the form proves that React bootstrapped before the journey proceeds.
  await page.getByRole('button', { name: 'Host a game' }).click();
  await page.getByLabel('Host display name').fill(`Smoke DM ${Date.now()}`);
  await page.getByRole('button', { name: /^Create game$/ }).click();

  await expect(page).toHaveURL(/\/lobby\/dm-setup$/);
  await page.getByLabel('Game Name').fill(`Resilience Smoke ${Date.now()}`);

  const webSocketPromise = page.waitForEvent('websocket');
  await page.getByRole('button', { name: /Create Game Room/ }).click();
  const webSocket = await webSocketPromise;

  await expect(page).toHaveURL(/\/lobby\/game\/[A-Z0-9]{4}$/);
  await expect(panelsDock(page)).toBeVisible();

  const roomCode = new URL(page.url()).pathname.split('/').at(-1);
  if (!roomCode) throw new Error('Room code missing from game URL.');

  return { roomCode, webSocket };
}

export async function createGuestPlayerSession(
  page: Page,
  roomCode: string,
  playerName: string,
): Promise<PlayerSession> {
  await page.goto('/lobby');
  await expect(page.getByRole('heading', { name: 'Nexus VTT' })).toBeVisible();

  await page.getByLabel('Display name', { exact: true }).fill(playerName);
  await page.getByLabel('Room code').fill(roomCode);

  const webSocketPromise = page.waitForEvent('websocket');
  await page.getByRole('button', { name: /^Join game$/ }).click();
  const webSocket = await webSocketPromise;

  await expect(page).toHaveURL(new RegExp(`/lobby/game/${roomCode}$`));
  await expect(panelsDock(page)).toBeVisible();

  return { roomCode, webSocket };
}

/** Open the panel when it is closed. */
export async function openPanel(page: Page, name: string): Promise<void> {
  if (await page.getByRole('dialog', { name, exact: true }).count()) return;
  await (await favoriteOrListedPanel(page, name)).click();
}

/** Close the panel whether it is in front or behind another window. */
export async function closePanel(page: Page, name: string): Promise<void> {
  const dialog = page.getByRole('dialog', { name, exact: true });
  if (!(await dialog.count())) return;

  const panel = await favoriteOrListedPanel(page, name);
  if ((await panel.getAttribute('data-topmost')) !== 'true') {
    await panel.click();
  }
  await (await favoriteOrListedPanel(page, name)).click();
}
