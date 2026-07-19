import { expect, test } from './support/diagnostics';
import { createGuestHostSession, openPanel } from './support/flows';
import {
  hasManagedSmokeStack,
  startSmokeService,
  stopSmokeService,
} from './support/stack';

test.describe.configure({ mode: 'serial' });

test('a guest host rolls 3D dice and reconnects after backend downtime', async ({
  diagnostics,
  page,
}) => {
  test.skip(
    !hasManagedSmokeStack(),
    'Backend restart requires npm run test:e2e.',
  );

  const connectionLogs: string[] = [];
  const diceAssetFailures: string[] = [];
  page.on('console', (message) => connectionLogs.push(message.text()));
  page.on('response', (response) => {
    if (
      response.url().includes('/assets/dice-box/') &&
      response.status() >= 400
    ) {
      diceAssetFailures.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on('requestfailed', (request) => {
    if (request.url().includes('/assets/dice-box/')) {
      diceAssetFailures.push(
        `${request.failure()?.errorText ?? 'failed'} ${request.url()}`,
      );
    }
  });

  const { roomCode } = await createGuestHostSession(page);
  await expect(page.locator('#dice-box canvas')).toBeVisible();

  await openPanel(page, 'Dice');
  await expect(
    page.getByRole('heading', { name: 'Dice Roller' }),
  ).toBeVisible();
  await expect(page.getByText('Offline', { exact: true })).toHaveCount(0);

  const themeButton = page.getByTitle(/^Dice Theme:/);
  await themeButton.click();
  await expect(themeButton).toHaveAttribute(
    'title',
    'Dice Theme: Dice of Rolling',
  );
  expect(
    await page.evaluate(() => localStorage.getItem('nexus_dice_theme')),
  ).toBe('diceOfRolling');

  await page
    .getByPlaceholder('Click dice below to build your roll...')
    .fill('1d20+2');
  await page.getByRole('button', { name: 'Roll', exact: true }).click();
  await expect(page.locator('.dice-roller__roll--new')).toContainText('1d20+2');
  expect(diceAssetFailures).toEqual([]);

  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/lobby/game/${roomCode}$`));
  await expect(page.getByRole('tablist', { name: 'Panels' })).toBeVisible();

  const confirmedReconnectionsBeforeRestart = connectionLogs.filter((entry) =>
    entry.includes('Session reconnected:'),
  ).length;

  let backendStopped = false;
  try {
    await stopSmokeService('backend');
    backendStopped = true;

    await expect
      .poll(() =>
        connectionLogs.some((entry) =>
          entry.includes('WebSocket disconnected'),
        ),
      )
      .toBe(true);
    await expect
      .poll(
        () =>
          connectionLogs.filter((entry) =>
            entry.includes('Reconnection failed'),
          ).length,
        { timeout: 10_000 },
      )
      .toBeGreaterThan(0);

    await startSmokeService('backend');
    backendStopped = false;

    await expect
      .poll(
        () =>
          connectionLogs.filter((entry) =>
            entry.includes('Session reconnected:'),
          ).length,
        { timeout: 20_000 },
      )
      .toBeGreaterThan(confirmedReconnectionsBeforeRestart);
  } finally {
    if (backendStopped) await startSmokeService('backend');
  }

  await openPanel(page, 'Dice');
  await page
    .getByPlaceholder('Click dice below to build your roll...')
    .fill('1d6');
  await page.getByRole('button', { name: 'Roll', exact: true }).click();
  await expect(page.locator('.dice-roller__roll--new')).toContainText('1d6');
  expect(diagnostics.pageErrors).toEqual([]);
});

test('the lobby remains usable while the asset service recovers', async ({
  diagnostics,
  page,
  request,
}) => {
  test.skip(
    !hasManagedSmokeStack(),
    'Asset-service restart requires npm run test:e2e.',
  );

  await page.goto('/lobby');
  await expect(page.getByRole('heading', { name: 'Nexus VTT' })).toBeVisible();
  const assetServiceUrl = process.env.E2E_ASSET_URL ?? 'http://127.0.0.1:15003';
  expect((await request.get(`${assetServiceUrl}/manifest.json`)).status()).toBe(
    200,
  );

  let assetServiceStopped = false;
  try {
    await stopSmokeService('asset-service');
    assetServiceStopped = true;

    await expect
      .poll(async () => {
        try {
          return (
            await request.get(`${assetServiceUrl}/manifest.json`, {
              timeout: 2_000,
            })
          ).ok();
        } catch {
          return false;
        }
      })
      .toBe(false);

    await page.getByLabel('Enter Your Name').fill('Degraded Mode Tester');
    const dungeonMasterRole = page.getByRole('radio', {
      name: /Dungeon Master/,
    });
    await page.getByText('Dungeon Master', { exact: true }).click();
    await expect(dungeonMasterRole).toBeChecked();
    await expect(
      page.getByRole('button', { name: /Create Game$/ }),
    ).toBeEnabled();

    await startSmokeService('asset-service');
    assetServiceStopped = false;

    await expect
      .poll(async () =>
        (await request.get(`${assetServiceUrl}/manifest.json`)).status(),
      )
      .toBe(200);
  } finally {
    if (assetServiceStopped) await startSmokeService('asset-service');
  }

  expect(diagnostics.pageErrors).toEqual([]);
});
