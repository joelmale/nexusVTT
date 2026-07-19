import type { APIResponse } from '@playwright/test';

import { expect, test } from './support/diagnostics';

const DICE_THEME_IDS = [
  'blueGreenMetal',
  'default',
  'default-extras',
  'diceOfRolling',
  'diceOfRolling-fate',
  'gemstone',
  'gemstoneMarble',
  'genesys',
  'rock',
  'rust',
  'smooth',
  'smooth-pip',
  'wooden',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function collectFileReferences(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (!isRecord(value)) return [];
  return Object.values(value).flatMap(collectFileReferences);
}

function themeReferences(config: unknown): string[] {
  if (!isRecord(config)) throw new TypeError('Theme config must be an object.');

  const references = new Set<string>();
  if (typeof config.meshFile === 'string') references.add(config.meshFile);

  if (isRecord(config.material)) {
    for (const key of ['diffuseTexture', 'bumpTexture', 'specularTexture']) {
      collectFileReferences(config.material[key]).forEach((file) =>
        references.add(file),
      );
    }
  }

  return [...references];
}

async function expectNonEmpty(response: APIResponse, label: string) {
  expect(response.status(), label).toBe(200);
  expect((await response.body()).byteLength, label).toBeGreaterThan(0);
}

test('production services are healthy and guest sessions round-trip', async ({
  request,
}) => {
  const backendUrl = process.env.E2E_BACKEND_URL ?? 'http://127.0.0.1:15001';

  const frontendHealth = await request.get('/health');
  expect(frontendHealth.status()).toBe(200);
  expect(await frontendHealth.text()).toContain('healthy');

  const backendHealth = await request.get(`${backendUrl}/health`);
  expect(backendHealth.status()).toBe(200);
  expect(await backendHealth.json()).toMatchObject({ status: 'ok' });

  const guestName = `Health Smoke ${Date.now()}`;
  const createGuest = await request.post('/api/guest-users', {
    data: { name: guestName },
  });
  expect(createGuest.status()).toBe(201);
  expect(await createGuest.json()).toMatchObject({
    name: guestName,
    provider: 'guest',
  });

  const guestSession = await request.get('/api/guest-me');
  expect(guestSession.status()).toBe(200);
  expect(await guestSession.json()).toMatchObject({ name: guestName });
});

test('production serves the complete dice runtime asset graph', async ({
  request,
}) => {
  await expectNonEmpty(
    await request.get('/assets/dice-box/ammo/ammo.wasm.wasm'),
    'Ammo WASM',
  );

  for (const themeId of DICE_THEME_IDS) {
    const themeRoot = `/assets/dice-box/themes/${themeId}`;
    const configResponse = await request.get(`${themeRoot}/theme.config.json`);
    await expectNonEmpty(configResponse, `${themeId} config`);
    const config: unknown = await configResponse.json();

    for (const file of themeReferences(config)) {
      await expectNonEmpty(
        await request.get(`${themeRoot}/${file}`),
        `${themeId}/${file}`,
      );
    }
  }
});

test('the warmed production shell reloads while offline', async ({
  context,
  diagnostics,
  page,
}) => {
  await page.goto('/lobby');
  await expect(page.getByRole('heading', { name: 'Nexus VTT' })).toBeVisible();
  await expect(page.getByLabel('Enter Your Name')).toBeVisible();

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  // A newly activated worker does not have to control the navigation that
  // installed it. Reload once online, then prove the controlled shell survives
  // an offline navigation.
  if (
    !(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
  ) {
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller?.state ?? null),
    )
    .toBe('activated');

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('heading', { name: 'Nexus VTT' }),
    ).toBeVisible();
  } finally {
    await context.setOffline(false);
  }

  expect(diagnostics.pageErrors).toEqual([]);
});
