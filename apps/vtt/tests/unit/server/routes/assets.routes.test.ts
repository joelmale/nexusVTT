import express, { type Express } from 'express';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const proxyOptions: Array<Record<string, unknown>> = [];
vi.mock('http-proxy-middleware', () => ({
  createProxyMiddleware: vi.fn((options: Record<string, unknown>) => {
    proxyOptions.push(options);
    return (_req: unknown, _res: unknown, next: () => void) => next();
  }),
}));

import { createAssetRouter } from '../../../../server/routes/assets.routes.js';

describe('asset routes', () => {
  let server: Server | undefined;
  beforeEach(() => { proxyOptions.length = 0; vi.stubEnv('ASSET_SERVICE_SECRET', 'test-secret'); });
  afterEach(async () => { if (server) await new Promise<void>((resolve, reject) => server?.close((error) => error ? reject(error) : resolve())); server = undefined; vi.unstubAllEnvs(); });

  it('mounts public and guarded user proxies with the expected rewrites', () => {
    const router = createAssetRouter({ assetApiUrl: 'http://assets.test' });
    expect(router).toBeDefined();
    expect(proxyOptions).toHaveLength(2);
    const publicRewrite = proxyOptions[0].pathRewrite as (path: string, req: { originalUrl?: string }) => string;
    const userRewrite = proxyOptions[1].pathRewrite as (path: string, req: { originalUrl?: string }) => string;
    expect(publicRewrite('/stripped', { originalUrl: '/Maps/assets/map.png?size=small' })).toBe('/Maps/assets/map.png?size=small');
    expect(userRewrite('/stripped', { originalUrl: '/api/user/alice/assets/map.png' })).toBe('/user/alice/assets/map.png');
  });

  it('returns the API fallback while allowing non-API requests to continue', async () => {
    const app: Express = express();
    app.use(createAssetRouter({ assetApiUrl: 'http://assets.test' }));
    app.use((_req, res) => res.status(204).send());
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server?.once('listening', resolve));
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('Expected TCP server');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const api = await fetch(`${baseUrl}/api/unknown`);
    expect(api.status).toBe(404); await expect(api.json()).resolves.toMatchObject({ error: 'Not found' });
    expect((await fetch(`${baseUrl}/unrelated`)).status).toBe(204);
  });
});
