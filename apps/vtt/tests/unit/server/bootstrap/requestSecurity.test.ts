import express from 'express';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createBrowserMutationGuard,
  createRequestRateLimiter,
} from '../../../../server/bootstrap/requestSecurity.js';

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
});
async function serve(app: express.Express): Promise<string> {
  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Missing test address');
  return `http://127.0.0.1:${address.port}`;
}

describe('browser mutation protection', () => {
  it('rejects foreign, null, malformed, sibling and unproven cookie requests before handlers', async () => {
    const app = express();
    app.use(
      createBrowserMutationGuard(['https://table.example.test'], 'production'),
    );
    app.all('/write', (_req, res) => res.sendStatus(204));
    app.get('/auth/logout', (_req, res) => res.sendStatus(204));
    const url = await serve(app);
    for (const headers of [
      { origin: 'https://evil.test' },
      { origin: 'null' },
      { origin: 'https://table.example.test/path' },
      { 'sec-fetch-site': 'cross-site' },
      { 'sec-fetch-site': 'same-site' },
      { cookie: 'session=opaque' },
      { referer: 'https://evil.test/form' },
    ]) {
      expect(
        (await fetch(`${url}/write`, { method: 'POST', headers })).status,
      ).toBe(403);
    }
    expect(
      (
        await fetch(`${url}/auth/logout`, {
          headers: { 'sec-fetch-site': 'cross-site' },
        })
      ).status,
    ).toBe(403);
    expect((await fetch(`${url}/write`)).status).toBe(204);
  });

  it('allows configured origins, same-origin browsers, trusted legacy referrers and cookieless CLI', async () => {
    const app = express();
    app.use(
      createBrowserMutationGuard(['https://table.example.test'], 'production'),
    );
    app.post('/write', (_req, res) => res.sendStatus(204));
    const url = await serve(app);
    for (const headers of [
      { origin: 'https://table.example.test', cookie: 'session=opaque' },
      { 'sec-fetch-site': 'same-origin', cookie: 'session=opaque' },
      { referer: 'https://table.example.test/page', cookie: 'session=opaque' },
      {},
    ])
      expect(
        (await fetch(`${url}/write`, { method: 'POST', headers })).status,
      ).toBe(204);
  });

  it('permits localhost origins only in development', async () => {
    for (const environment of ['development', 'production']) {
      const app = express();
      app.use(createBrowserMutationGuard([], environment));
      app.post('/write', (_req, res) => res.sendStatus(204));
      const url = await serve(app);
      expect(
        (
          await fetch(`${url}/write`, {
            method: 'POST',
            headers: { origin: 'http://localhost:5173' },
          })
        ).status,
      ).toBe(environment === 'development' ? 204 : 403);
    }
  });
});

describe('bounded request admission', () => {
  it('shares the credential budget across login/register paths and resets after expiry', async () => {
    let time = 0;
    const app = express();
    app.use(createRequestRateLimiter({ now: () => time }));
    app.post(['/auth/login', '/auth/register'], (_req, res) =>
      res.sendStatus(401),
    );
    const url = await serve(app);
    for (let index = 0; index < 20; index++) {
      expect(
        (
          await fetch(`${url}/auth/${index % 2 ? 'register' : 'login'}`, {
            method: 'POST',
          })
        ).status,
      ).toBe(401);
    }
    const blocked = await fetch(`${url}/AUTH/LOGIN/?query=ignored`, {
      method: 'POST',
    });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBe('900');
    time = 900_000;
    expect((await fetch(`${url}/auth/login`, { method: 'POST' })).status).toBe(
      401,
    );
  });

  it('limits guest creation and aggregate API requests, preserving readiness and preflight', async () => {
    const app = express();
    app.use(createRequestRateLimiter());
    app.use((_req, res) => res.sendStatus(204));
    const url = await serve(app);
    for (let index = 0; index < 120; index++)
      expect(
        (await fetch(`${url}/api/guest-users`, { method: 'POST' })).status,
      ).toBe(204);
    expect(
      (await fetch(`${url}/api/guest-users`, { method: 'POST' })).status,
    ).toBe(429);
    for (let index = 121; index < 600; index++)
      expect((await fetch(`${url}/api/characters`)).status).toBe(204);
    expect((await fetch(`${url}/api/characters`)).status).toBe(429);
    expect((await fetch(`${url}/api/system/health`)).status).toBe(204);
    expect(
      (await fetch(`${url}/api/characters`, { method: 'OPTIONS' })).status,
    ).toBe(204);
  });

  it('fails closed at key capacity, retires expired entries, and does not trust raw forwarded headers', async () => {
    let time = 0;
    const app = express();
    app.use(createRequestRateLimiter({ maxKeys: 1, now: () => time }));
    app.use((_req, res) => res.sendStatus(204));
    const url = await serve(app);
    expect(
      (
        await fetch(`${url}/api/characters`, {
          headers: { 'x-forwarded-for': '192.0.2.1' },
        })
      ).status,
    ).toBe(204);
    expect((await fetch(`${url}/auth/login`, { method: 'POST' })).status).toBe(
      503,
    );
    time = 60_000;
    expect((await fetch(`${url}/api/characters`)).status).toBe(204);
  });
});
