import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from './support/diagnostics';
import { createTestIdentity } from './support/testIdentity';
import { openPanel } from './support/flows';
import {
  hasManagedSmokeStack,
  killSmokeService,
  startSmokeService,
} from './support/stack';
import type { SessionPlan } from '@nexus/game-contracts';

test('Studio publishes linked map, handout and encounter and runs their real VTT actions', async ({
  browser,
  page,
  context,
  diagnostics,
}) => {
  test.skip(!hasManagedSmokeStack(), 'Requires disposable production stack.');
  test.setTimeout(180_000);
  const identity = await createTestIdentity(context);
  const playerContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const name = `Studio deployment ${Date.now()}`;
    const created = await context.request.post('/api/campaigns', {
      data: { name, edition: '2014' },
    });
    expect(created.status()).toBe(201);
    const { id: campaignId } = (await created.json()) as { id: string };
    const uploaded = await context.request.post(
      `/api/user/${identity.userId}/upload`,
      {
        multipart: {
          name: 'Smoke map',
          category: 'maps',
          file: {
            name: 'map.png',
            mimeType: 'image/png',
            buffer: readFileSync(
              new URL(
                '../../apps/generator-hub/public/one-page-dungeon/favicon.png',
                import.meta.url,
              ),
            ),
          },
        },
      },
    );
    expect(uploaded.ok(), await uploaded.text()).toBe(true);
    const { asset } = (await uploaded.json()) as {
      asset: { id: string; fullImage: string };
    };
    const now = new Date().toISOString();
    const locationId = randomUUID();
    const encounterId = randomUUID();
    const handoutId = randomUUID();
    async function create(kind: string, data: Record<string, unknown>) {
      const response = await context.request.post(
        `/api/campaigns/${campaignId}/prep/objects`,
        { data: { kind, data, requestId: randomUUID() } },
      );
      expect(response.status(), await response.text()).toBe(201);
    }
    const entry = (
      kind: string,
      id: string,
      title: string,
      fields: Record<string, unknown>,
    ) => ({
      id,
      campaignId,
      kind,
      title,
      revision: 1,
      schemaVersion: 1,
      visibility: 'dm-only',
      links: [],
      tags: [],
      createdAt: now,
      updatedAt: now,
      content: {
        format: 'lexical',
        schemaVersion: 1,
        value: {
          root: { type: 'root', children: [] },
          nexusStudio: { v: 1, fields },
        },
      },
    });
    await create(
      'location',
      entry('location', locationId, 'Smoke docks', {
        name: 'Smoke docks',
        type: 'settlement',
        shortDescription: 'Lanterns on the pier.',
      }),
    );
    await create(
      'encounter',
      entry('encounter', encounterId, 'Smoke ambush', {
        title: 'Smoke ambush',
        kind: 'combat',
        difficulty: 'easy',
        composition: [
          { name: 'Goblin', count: 2, monsterKey: 'srd:goblin', cr: '1/4' },
        ],
      }),
    );
    await create(
      'lore',
      entry('lore', handoutId, 'Smoke manifest', {
        title: 'Smoke manifest',
        body: 'Two crates arrive at dawn.',
        visibility: 'shared',
        audience: 'all',
      }),
    );
    await create('campaign-map', {
      id: randomUUID(),
      campaignId,
      title: 'Smoke map',
      schemaVersion: 1,
      revision: 1,
      imageAssetRef: { target: 'asset', assetId: asset.id },
      imageUrl: `/${asset.fullImage.replace(/^\/+/, '')}`,
      dimensions: { width: 192, height: 192 },
      layers: [],
      pins: [
        {
          id: 'dock-pin',
          label: 'Smoke docks',
          x: 0.5,
          y: 0.5,
          linkedObjectRefs: [
            {
              target: 'campaign-object',
              campaignId,
              id: locationId,
              revision: 1,
            },
          ],
        },
      ],
      createdAt: now,
      updatedAt: now,
    });
    // Seed campaign content, then author and publish through the actual Studio UI.
    await page.goto(`/codex-dm/campaigns/${campaignId}/sessions`);
    await page
      .getByRole('button', { name: /Plan a session/i })
      .first()
      .click();
    await page
      .getByLabel('Session Title', { exact: true })
      .fill('Deployment night');
    await page.getByRole('button', { name: /Campaign Hub/ }).click();
    await page.getByTestId('select-primary-location').selectOption(locationId);
    await page.getByTestId(`chip-encounter-${encounterId}`).focus();
    await page.keyboard.press('Space');
    await expect(
      page.getByTestId(`chip-encounter-${encounterId}`),
    ).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId(`chip-handout-${handoutId}`).click();
    await page.getByRole('button', { name: /Run-Sheet Beats/ }).click();
    await page
      .getByRole('button', { name: 'Auto-Generate Beat Spine', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Save & Open Run Sheet', exact: true })
      .click();
    await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]{36}\/plan$/);
    await page.reload();
    const publishedResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/publish') &&
        response.request().method() === 'POST',
    );
    await page
      .getByRole('button', { name: 'Publish plan', exact: true })
      .click();
    const published = await publishedResponse;
    expect(published.ok(), await published.text()).toBe(true);
    const result = (await published.json()) as { plan: SessionPlan };
    expect(result.plan.steps.map((step) => step.type)).toEqual(
      expect.arrayContaining([
        'activate-scene',
        'deploy-encounter',
        'share-handout',
      ]),
    );
    await page
      .getByRole('button', { name: 'Play in VTT', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Restart run in VTT', exact: true }),
    ).toBeEnabled();
    await page.goto('/dashboard');
    await page
      .getByTestId('table-card')
      .filter({ hasText: name })
      .getByRole('button', { name: 'Open Table', exact: true })
      .click();
    await expect(page).toHaveURL(/\/lobby\/game\/[A-Z0-9]{4}$/);
    const roomCode = new URL(page.url()).pathname.split('/').at(-1)!;
    const playerPage = await playerContext.newPage();
    await playerPage.goto(`/play/${roomCode}`);
    await playerPage.getByLabel('Your name').fill('Studio deployment player');
    await playerPage
      .getByRole('button', { name: 'Join game', exact: true })
      .click();
    await playerPage
      .getByRole('dialog', { name: 'Choose your character' })
      .getByRole('button', { name: 'Close', exact: true })
      .click();
    await openPanel(page, 'Session Run Sheet');
    const panel = page.getByTestId('session-plan-panel');
    async function expand(type: string) {
      const index = result.plan.steps.findIndex((step) => step.type === type);
      await panel
        .getByRole('button', {
          name: `Step ${index + 1}: ${result.plan.steps[index].title}`,
          exact: true,
        })
        .click();
    }
    await expand('activate-scene');
    const mapLoad = page.waitForResponse(
      (response) =>
        response.url().includes(asset.fullImage.replace(/^\/+/, '')) &&
        response.ok(),
    );
    await panel
      .getByRole('button', { name: 'Activate Scene', exact: true })
      .click();
    await expect(panel).toContainText(
      /Activated scene:|Created and activated scene:/,
    );
    await mapLoad;
    await expand('deploy-encounter');
    await panel
      .getByRole('button', { name: 'Deploy Encounter', exact: true })
      .click();
    await expect(panel).toContainText('Encounter deployed on active scene!');
    await expect(page.locator('[data-token-name^="Goblin"]')).toHaveCount(2);
    await expect(playerPage.locator('[data-token-name^="Goblin"]')).toHaveCount(
      2,
    );
    await expand('share-handout');
    await panel
      .getByRole('button', { name: 'Reveal Handout', exact: true })
      .click();
    await expect(panel).toContainText('Handout revealed to players.');
    await expect(
      playerPage
        .getByRole('dialog')
        .filter({ hasText: 'Two crates arrive at dawn.' }),
    ).toBeVisible();
    await playerPage
      .getByRole('button', { name: 'Close handout', exact: true })
      .click();
    await playerPage.reload();
    await expect(playerPage.locator('[data-token-name^="Goblin"]')).toHaveCount(
      2,
    );
    await expand('deploy-encounter');
    await panel
      .getByRole('button', { name: 'Start Combat', exact: true })
      .click();
    const encounterPanel = page.getByTestId('encounter-panel');
    await expect(encounterPanel).toContainText('Goblin #1');
    await expect(encounterPanel).toContainText('Goblin #2');
    await expect(encounterPanel).not.toContainText('Astarion');
    await encounterPanel.getByRole('button', { name: /Next Turn/ }).click();
    await expect(
      encounterPanel.getByTestId('encounter-turn'),
    ).toHaveText('2');

    // Durability Gate (CS-82): SIGKILL the backend replica after combat & deployment commit
    await killSmokeService('backend');
    await startSmokeService('backend');
    await playerPage.reload();
    await expect(playerPage.locator('[data-token-name^="Goblin"]')).toHaveCount(2);

    expect(diagnostics.pageErrors).toEqual([]);
  } finally {
    await playerContext.close();
    await identity.dispose();
  }
});
