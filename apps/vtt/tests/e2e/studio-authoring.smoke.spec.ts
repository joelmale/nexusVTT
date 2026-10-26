import { execFile } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { expect, test } from './support/diagnostics';
import { hasManagedSmokeStack } from './support/stack';

const executeFile = promisify(execFile);

/** Seed only an authenticated test identity in the disposable managed stack. */
async function smokeSql(sql: string) {
  if (!hasManagedSmokeStack())
    throw new Error('Requires the disposable managed smoke stack.');
  await executeFile(
    'docker',
    [
      'compose',
      '-p',
      process.env.E2E_PROJECT_NAME ?? 'nexus-vtt-e2e',
      '-f',
      'docker/docker-compose.smoke.yml',
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'nexus_smoke',
      '-d',
      'nexus_smoke',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      sql,
    ],
    { windowsHide: true },
  );
}

test('Studio authors and reloads a session through real persistence', async ({
  context,
  page,
  diagnostics,
}) => {
  test.skip(!hasManagedSmokeStack(), 'Requires npm run test:e2e.');
  const userId = randomUUID();
  const sessionId = randomUUID();
  const session = JSON.stringify({
    cookie: {
      originalMaxAge: 3600000,
      expires: new Date(Date.now() + 3600000).toISOString(),
      secure: false,
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
    },
    passport: { user: userId },
  });
  await smokeSql(
    `INSERT INTO users (id, name, provider) VALUES ('${userId}', 'Studio smoke author', 'google'); INSERT INTO session (sid, sess, expire) VALUES ('${sessionId}', '${session}'::json, NOW() + INTERVAL '1 hour');`,
  );
  const signature = createHmac('sha256', 'smoke-session-secret')
    .update(sessionId)
    .digest('base64')
    .replace(/=+$/, '');
  await context.addCookies([
    {
      name: 'connect.sid',
      value: `s:${sessionId}.${signature}`,
      url: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  try {
    const response = await context.request.post('/api/campaigns', {
      data: {
        name: 'Studio authoring smoke',
        edition: '2014',
        mode: 'one-shot',
        mood: 'parchment',
      },
    });
    expect(response.status()).toBe(201);
    const campaign: { id: string } = await response.json();
    await page.goto(`/codex-dm/campaigns/${campaign.id}/sessions`);
    await page
      .getByRole('button', { name: /Plan a session/i })
      .first()
      .click();
    await page
      .getByLabel('Session Title', { exact: true })
      .fill('A persisted session');
    await page.getByRole('button', { name: /Run-Sheet Beats/ }).click();
    await page
      .getByRole('button', { name: 'Add Custom Run-Sheet Beat', exact: true })
      .click();
    // This note-only journey needs no map assets; choose note beats in the real planner.
    const beatKinds = page.getByRole('combobox').filter({
      has: page.getByRole('option', { name: 'Atmospheric Scene', exact: true }),
    });
    for (const selector of await beatKinds.all())
      await selector.selectOption('note');
    await page.getByRole('button', { name: 'Save & Open Run Sheet' }).click();
    await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]{36}\/plan$/);
    await page.getByRole('tab', { name: 'Session Notes', exact: true }).click();
    await page
      .getByRole('textbox', { name: 'Session Notes', exact: true })
      .fill('Private notes survive a fresh navigation.');
    const saveResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/authoring') &&
        response.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    expect((await saveResponse).ok()).toBe(true);
    await page.reload();
    await page.getByRole('tab', { name: 'Session Notes', exact: true }).click();
    await expect(
      page.getByRole('textbox', { name: 'Session Notes', exact: true }),
    ).toHaveValue('Private notes survive a fresh navigation.');
    await page.getByRole('tab', { name: 'Run Sheet', exact: true }).click();
    await page.getByRole('button', { name: 'Add Step', exact: true }).click();
    const publishedResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/publish') &&
        response.request().method() === 'POST',
    );
    await page
      .getByRole('button', { name: 'Publish plan', exact: true })
      .click();
    const published = await publishedResponse;
    expect(
      await published.text(),
      'Publication should succeed against real persistence',
    ).toBeTruthy();
    expect(published.ok()).toBe(true);
    await expect(
      page.getByRole('button', { name: 'Play in VTT', exact: true }),
    ).toBeEnabled();
    const activatedResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/activate') &&
        response.request().method() === 'POST',
    );
    await page
      .getByRole('button', { name: 'Play in VTT', exact: true })
      .click();
    expect((await activatedResponse).ok()).toBe(true);
    await expect(
      page.getByRole('button', { name: 'Restart run in VTT', exact: true }),
    ).toBeEnabled();
    expect(diagnostics.pageErrors).toEqual([]);
  } finally {
    await smokeSql(
      `DELETE FROM session WHERE sid = '${sessionId}'; DELETE FROM users WHERE id = '${userId}';`,
    );
  }
});
