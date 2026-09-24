import type { APIResponse } from '@playwright/test';

import { expect, test } from './support/diagnostics';

const DICE_RUNTIME_TEXTURES = [
  'astral.webp',
  'bronze01.webp',
  'dragon.webp',
  'fire.webp',
  'glitter.webp',
  'ice.webp',
  'marble.webp',
  'metal.webp',
  'paper.webp',
  'wood.webp',
] as const;

const DICE_RUNTIME_SOUNDS = [
  'dicehit/dicehit_coin1.mp3',
  'dicehit/dicehit_metal1.mp3',
  'dicehit/dicehit_wood1.mp3',
  'surfaces/surface_felt1.mp3',
  'surfaces/surface_wood_table1.mp3',
] as const;

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

  const backendHealth = await request.get(`${backendUrl}/api/system/health`);
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
  for (const texture of DICE_RUNTIME_TEXTURES) {
    await expectNonEmpty(
      await request.get(`/assets/dice-box-threejs/textures/${texture}`),
      `dice texture: ${texture}`,
    );
  }

  for (const sound of DICE_RUNTIME_SOUNDS) {
    await expectNonEmpty(
      await request.get(`/assets/dice-box-threejs/sounds/${sound}`),
      `dice sound: ${sound}`,
    );
  }
});

test('the bundled Character Forge renders outside the VTT shell', async ({
  diagnostics,
  page,
}) => {
  await page.goto('/forge/');

  await expect(page).toHaveTitle('NexusForge');
  await expect(
    page.getByRole('button', { name: 'New Character' }),
  ).toBeVisible();
  expect(diagnostics.pageErrors).toEqual([]);
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
