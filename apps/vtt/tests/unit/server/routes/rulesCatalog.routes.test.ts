import express, { type Express } from 'express';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createRulesCatalogRouter } from '../../../../server/routes/rulesCatalog.routes.js';
import type { RulesCatalogCache } from '../../../../server/services/rulesCatalogClient.js';

describe('rules catalog BFF', () => {
  let server: Server | undefined;

  afterEach(
    () =>
      new Promise<void>((resolve, reject) => {
        if (!server) {
          resolve();
          return;
        }
        server.close((error) => {
          server = undefined;
          if (error) reject(error);
          else resolve();
        });
      }),
  );

  function fakeCache(overrides: Partial<RulesCatalogCache> = {}): RulesCatalogCache {
    return {
      getManifest: vi.fn(),
      getEntities: vi.fn(),
      ...overrides,
    } as unknown as RulesCatalogCache;
  }

  async function startApp(options: {
    cache?: RulesCatalogCache;
    docApiUrl?: string;
    session?: 'guest' | 'authenticated' | 'none';
  }): Promise<string> {
    const app: Express = express();
    app.use((req, _res, next) => {
      const session = options.session ?? 'authenticated';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).isAuthenticated = () => session === 'authenticated';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).session =
        session === 'guest' ? { guestUser: { id: 'guest-1', name: 'Guest', provider: 'guest' } } : {};
      next();
    });
    app.use(
      '/api',
      createRulesCatalogRouter({
        docApiUrl: options.docApiUrl,
        cache: options.cache,
      }),
    );

    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve, reject) => {
      server?.once('listening', resolve);
      server?.once('error', reject);
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected the test server to listen on a TCP port');
    }
    return `http://127.0.0.1:${address.port}`;
  }

  it('rejects a request with no session at all', async () => {
    const baseUrl = await startApp({ cache: fakeCache(), session: 'none' });

    const response = await fetch(`${baseUrl}/api/rules/catalog/manifest`);

    expect(response.status).toBe(401);
  });

  it('allows a guest session to read the manifest', async () => {
    const cache = fakeCache({
      getManifest: vi.fn().mockResolvedValue({ status: 200, body: { catalogVersion: 1 }, etag: 'W/"1"' }),
    });
    const baseUrl = await startApp({ cache, session: 'guest' });

    const response = await fetch(`${baseUrl}/api/rules/catalog/manifest`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ catalogVersion: 1 });
    expect(response.headers.get('etag')).toBe('W/"1"');
  });

  it('allows an authenticated session and forwards the ETag as a 304', async () => {
    const getManifest = vi.fn().mockResolvedValue({ status: 304 });
    const baseUrl = await startApp({ cache: fakeCache({ getManifest }) });

    const response = await fetch(`${baseUrl}/api/rules/catalog/manifest`, {
      headers: { 'If-None-Match': 'W/"1"' },
    });

    expect(response.status).toBe(304);
    expect(getManifest).toHaveBeenCalledWith('W/"1"');
  });

  it('returns 503 with useBundled when DOC_API_URL is not configured', async () => {
    const baseUrl = await startApp({ docApiUrl: undefined, cache: undefined });

    const response = await fetch(`${baseUrl}/api/rules/catalog/manifest`);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'rules_catalog_unavailable', useBundled: true });
  });

  it('returns 503 with useBundled when the cache reports doc-api is unreachable', async () => {
    const baseUrl = await startApp({ cache: fakeCache({ getManifest: vi.fn().mockResolvedValue({ status: 503 }) }) });

    const response = await fetch(`${baseUrl}/api/rules/catalog/manifest`);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'rules_catalog_unavailable', useBundled: true });
  });

  it('reads only the fixed type/ruleset/since query keys for entities', async () => {
    const getEntities = vi
      .fn()
      .mockResolvedValue({ status: 200, body: { catalogVersion: 1, since: 0, entities: [], removed: [], skipped: [] }, etag: 'W/"1"' });
    const baseUrl = await startApp({ cache: fakeCache({ getEntities }) });

    const response = await fetch(
      `${baseUrl}/api/rules/catalog/entities?type=spell&ruleset=2024&since=3&path=/etc/passwd&extra=ignored`,
    );

    expect(response.status).toBe(200);
    expect(getEntities).toHaveBeenCalledWith({ type: 'spell', ruleset: '2024', since: 3 }, null);
  });

  it('rejects an invalid entities query without touching the cache', async () => {
    const getEntities = vi.fn();
    const baseUrl = await startApp({ cache: fakeCache({ getEntities }) });

    const response = await fetch(`${baseUrl}/api/rules/catalog/entities?type=not-a-real-type`);

    expect(response.status).toBe(400);
    expect(getEntities).not.toHaveBeenCalled();
  });

  it('does not consume unrelated API routes', async () => {
    const cache = fakeCache();
    const app: Express = express();
    app.use((req, _res, next) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).isAuthenticated = () => true;
      next();
    });
    app.use('/api', createRulesCatalogRouter({ docApiUrl: 'http://doc-api.test', cache }));
    app.get('/api/metrics/multiplayer', (_req, res) => res.json({ status: 'available' }));

    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve, reject) => {
      server?.once('listening', resolve);
      server?.once('error', reject);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('no port');
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const response = await fetch(`${baseUrl}/api/metrics/multiplayer`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'available' });
  });
});
