import { execFile } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import type { BrowserContext } from '@playwright/test';
import { hasManagedSmokeStack } from './stack';

/** Disposable managed PostgreSQL only; never a production authentication hook. */
export async function createTestIdentity(context: BrowserContext) {
  if (!hasManagedSmokeStack())
    throw new Error('Test identity requires the managed smoke stack.');
  const userId = randomUUID();
  const sid = randomUUID();
  const sql = async (statement: string) =>
    promisify(execFile)(
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
        statement,
      ],
      { windowsHide: true },
    );
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
  // connect-pg-simple creates this lazily during the first session write.
  // An isolated account fixture may run before any guest has visited the app.
  await sql(
    'CREATE TABLE IF NOT EXISTS session (sid varchar PRIMARY KEY, sess json NOT NULL, expire timestamp(6) NOT NULL); CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON session (expire);',
  );
  await sql(
    `INSERT INTO users (id, name, provider) VALUES ('${userId}', 'Creator matrix subject', 'google'); INSERT INTO session (sid, sess, expire) VALUES ('${sid}', '${session}'::json, NOW() + INTERVAL '1 hour');`,
  );
  const signature = createHmac('sha256', 'smoke-session-secret')
    .update(sid)
    .digest('base64')
    .replace(/=+$/, '');
  await context.addCookies([
    {
      name: 'connect.sid',
      value: `s:${sid}.${signature}`,
      url: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  return {
    userId,
    dispose: () =>
      sql(
        `DELETE FROM session WHERE sid = '${sid}'; DELETE FROM users WHERE id = '${userId}';`,
      ),
  };
}
