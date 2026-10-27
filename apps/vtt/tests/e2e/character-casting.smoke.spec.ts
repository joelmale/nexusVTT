import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from './support/diagnostics';
import { createTestIdentity } from './support/testIdentity';
import { openPanel } from './support/flows';
import { hasManagedSmokeStack } from './support/stack';
import { routeWebSocketsToBackend } from './support/websocket-observer';
import type { Character } from '@nexus/character-contracts';

const fixtures = JSON.parse(
  readFileSync(
    new URL('./fixtures/creator-reference-drafts.json', import.meta.url),
    'utf8',
  ),
) as Record<string, { character: Character }>;

test('two clients cast a saved character, retry a committed command and reconnect to shared resources', async ({
  browser,
}) => {
  test.skip(!hasManagedSmokeStack(), 'Requires disposable production stack.');
  test.setTimeout(180_000);
  const host = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const player = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const identity = await createTestIdentity(host);
  try {
    const hostPage = await host.newPage();
    const playerPage = await player.newPage();
    await routeWebSocketsToBackend(
      hostPage,
      process.env.E2E_BACKEND_URL ?? 'http://127.0.0.1:15001',
    );
    await routeWebSocketsToBackend(
      playerPage,
      process.env.E2E_BACKEND_PEER_URL ?? 'http://127.0.0.1:15002',
    );
    const campaignName = `Casting table ${Date.now()}`;
    const campaignResponse = await host.request.post('/api/campaigns', {
      data: { name: campaignName, edition: '2024' },
    });
    expect(campaignResponse.status()).toBe(201);
    await hostPage.goto('/dashboard');
    await hostPage
      .getByTestId('table-card')
      .filter({ hasText: campaignName })
      .getByRole('button', { name: 'Open Table', exact: true })
      .click();
    await expect(hostPage).toHaveURL(/\/lobby\/game\/[A-Z0-9]{4}$/);
    const roomCode = new URL(hostPage.url()).pathname.split('/').at(-1)!;
    const name = 'Recovery wizard';
    const character = {
      ...fixtures.W24.character,
      id: randomUUID(),
      name,
      resources: [
        {
          id: 'arcane-recovery',
          name: 'Arcane Recovery',
          description: 'Choose slot recovery explicitly.',
          maxUses: 1,
          currentUses: 1,
          rechargeType: 'long-rest' as const,
          recovery: { longRest: 'full' as const },
        },
      ],
    };
    await openPanel(hostPage, 'Characters');
    await hostPage.getByRole('button', { name: /Import/ }).click();
    await hostPage.locator('input[type="file"][accept=".json"]').setInputFiles({
      name: 'wizard.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(character)),
    });
    await hostPage.getByRole('button', { name: 'Import 1 Character' }).click();
    const card = hostPage.locator('.character-card').filter({ hasText: name });
    await expect(card).toBeVisible();
    await playerPage.goto(`/play/${roomCode}`);
    await playerPage.getByLabel('Your name').fill('Casting player');
    await playerPage.getByRole('button', { name: 'Join game' }).click();
    await playerPage
      .getByRole('button', { name: new RegExp(`Play as ${name}`) })
      .click();
    await expect(playerPage.getByTestId('simple-ribbon')).toContainText(name);
    await playerPage
      .getByRole('navigation', { name: 'Simple mode' })
      .getByRole('button', { name: 'My Hero', exact: true })
      .click();
    await playerPage.getByRole('tab', { name: 'Spells', exact: true }).click();
    const playerBook = playerPage.getByRole('region', {
      name: 'Spellbook',
      exact: true,
    });
    await expect(
      playerBook.getByText('Level 1: 2 / 2', { exact: true }),
    ).toBeVisible();
    await card.getByTitle('View Character Sheet', { exact: true }).click();
    const hostBook = hostPage.getByRole('region', {
      name: 'Spellbook',
      exact: true,
    });
    await expect(
      hostBook.getByText('Level 1: 2 / 2', { exact: true }),
    ).toBeVisible();
    const castIds: string[] = [];
    await playerBook
      .getByRole('button', { name: 'Use Arcane Recovery', exact: true })
      .click();
    await expect(
      playerBook.getByText('0 / 1 remaining', { exact: true }),
    ).toBeVisible();
    await expect(
      hostBook.getByText('0 / 1 remaining', { exact: true }),
    ).toBeVisible();
    let dropCommittedResponse = true;
    await playerPage.route('**/api/campaigns/*/commands', async (route) => {
      const body = route.request().postDataJSON() as {
        commandId: string;
        payload?: { type?: string };
      };
      if (body.payload?.type === 'CastSpell') {
        castIds.push(body.commandId);
        if (dropCommittedResponse) {
          dropCommittedResponse = false;
          const committed = await route.fetch();
          expect(committed.ok()).toBe(true);
          await route.abort('failed');
          return;
        }
      }
      await route.continue();
    });
    await playerBook
      .getByRole('button', { name: 'Cast Magic Missile', exact: true })
      .click();
    await expect(
      playerBook.getByRole('button', { name: 'Retry confirmation' }),
    ).toBeVisible();
    await expect(
      hostBook.getByText('Level 1: 1 / 2', { exact: true }),
    ).toBeVisible();
    await playerBook
      .getByRole('button', { name: 'Retry confirmation' })
      .click();
    await expect(
      playerBook.getByRole('button', { name: 'Retry confirmation' }),
    ).toBeHidden();
    await expect(
      playerBook.getByText('Level 1: 1 / 2', { exact: true }),
    ).toBeVisible();
    expect(castIds).toHaveLength(2);
    expect(castIds[1]).toBe(castIds[0]);

    await player.setOffline(true);
    await hostBook
      .getByRole('button', { name: 'Cast Magic Missile', exact: true })
      .click();
    await expect(
      hostBook.getByText('Level 1: 0 / 2', { exact: true }),
    ).toBeVisible();
    await player.setOffline(false);
    await playerPage.reload();
    await playerPage
      .getByRole('navigation', { name: 'Simple mode' })
      .getByRole('button', { name: 'My Hero', exact: true })
      .click();
    await playerPage.getByRole('tab', { name: 'Spells', exact: true }).click();
    await expect(
      playerBook.getByText('0 / 1 remaining', { exact: true }),
    ).toBeVisible();
    await expect(
      playerBook.getByText('Level 1: 0 / 2', { exact: true }),
    ).toBeVisible();
    await expect(
      playerBook.getByRole('button', {
        name: 'Cast Magic Missile',
        exact: true,
      }),
    ).toBeDisabled();
    await playerBook
      .getByRole('button', { name: 'Long Rest', exact: true })
      .click();
    await expect(
      playerBook.getByText('Level 1: 2 / 2', { exact: true }),
    ).toBeVisible();
    await expect(
      hostBook.getByText('Level 1: 2 / 2', { exact: true }),
    ).toBeVisible();
    await expect(
      playerBook.getByText('1 / 1 remaining', { exact: true }),
    ).toBeVisible();
    await expect(
      hostBook.getByText('1 / 1 remaining', { exact: true }),
    ).toBeVisible();
    await playerBook
      .getByRole('button', { name: 'Apply preparation', exact: true })
      .click();
    await expect(
      playerBook.getByRole('button', { name: 'Cast Sleep', exact: true }),
    ).toBeEnabled();
    await playerBook
      .getByRole('button', { name: 'Cast Sleep', exact: true })
      .click();
    await expect(playerBook).toContainText('Concentrating on Sleep');
    await expect(hostBook).toContainText('Concentrating on Sleep');
    await playerBook
      .getByRole('button', { name: 'End concentration', exact: true })
      .click();
    await expect(playerBook).not.toContainText('Concentrating on Sleep');
    await expect(hostBook).not.toContainText('Concentrating on Sleep');
    await playerBook
      .getByRole('button', { name: 'Short Rest', exact: true })
      .click();
    await expect(
      playerBook.getByText('Level 1: 1 / 2', { exact: true }),
    ).toBeVisible();
    await expect(
      hostBook.getByText('Level 1: 1 / 2', { exact: true }),
    ).toBeVisible();
  } finally {
    await host.close();
    await player.close();
    await identity.dispose();
  }
});
