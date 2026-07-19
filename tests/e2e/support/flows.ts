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
  await page.getByLabel('Enter Your Name').fill(`Smoke DM ${Date.now()}`);
  const dungeonMasterRole = page.getByRole('radio', {
    name: /Dungeon Master/,
  });
  await page.getByText('Dungeon Master', { exact: true }).click();
  await expect(dungeonMasterRole).toBeChecked();
  await page.getByRole('button', { name: /Create Game$/ }).click();

  await expect(page).toHaveURL(/\/lobby\/dm-setup$/);
  await page.getByLabel('Game Name').fill(`Resilience Smoke ${Date.now()}`);

  const webSocketPromise = page.waitForEvent('websocket');
  await page.getByRole('button', { name: /Create Game Room/ }).click();
  const webSocket = await webSocketPromise;

  await expect(page).toHaveURL(/\/lobby\/game\/[A-Z0-9]{4}$/);
  await expect(page.getByRole('tablist', { name: 'Panels' })).toBeVisible();

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

  await page.getByLabel('Enter Your Name').fill(playerName);
  const playerRole = page.getByRole('radio', { name: /Player/ });
  await page.getByText('Player', { exact: true }).click();
  await expect(playerRole).toBeChecked();
  await page.getByPlaceholder('Room Code').fill(roomCode);

  const webSocketPromise = page.waitForEvent('websocket');
  await page.getByRole('button', { name: /Quick Join/ }).click();
  const webSocket = await webSocketPromise;

  await expect(page).toHaveURL(new RegExp(`/lobby/game/${roomCode}$`));
  await expect(page.getByRole('tablist', { name: 'Panels' })).toBeVisible();

  return { roomCode, webSocket };
}

export async function openPanel(page: Page, name: string): Promise<void> {
  const panelDock = page.getByRole('tablist', { name: 'Panels' });
  await panelDock.hover();
  const tab = page.getByRole('tab', { name, exact: true });
  await expect(tab).toBeVisible();
  await tab.click();
}
