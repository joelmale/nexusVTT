import express, { type Express } from 'express';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';

import type { DatabaseService } from '../../../../server/database.js';
import { createDocumentRoutes } from '../../../../server/routes/documents.js';

describe('disabled document routes', () => {
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

  async function startApp(): Promise<string> {
    const app: Express = express();
    app.use('/api', createDocumentRoutes(null, false, {} as DatabaseService));
    app.get('/api/metrics/multiplayer', (_request, response) => {
      response.json({ status: 'available' });
    });

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

  it('does not consume unrelated API routes', async () => {
    const baseUrl = await startApp();

    const response = await fetch(`${baseUrl}/api/metrics/multiplayer`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'available' });
  });

  it('returns unavailable only for document-service paths', async () => {
    const baseUrl = await startApp();

    const response = await fetch(`${baseUrl}/api/documents`);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Document service unavailable',
    });
  });

  it('reports the optional document service as disabled', async () => {
    const baseUrl = await startApp();

    const response = await fetch(`${baseUrl}/api/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'disabled' });
  });
});

describe('parameter tampering safety on enabled document routes', () => {
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

  async function startApp(): Promise<string> {
    const app: Express = express();
    app.use((req, _res, next) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).session = {
        guestUser: { id: 'guest-1', name: 'Guest', provider: 'guest' },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).isAuthenticated = () => true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).user = { id: 'guest-1' };
      next();
    });

    const mockClient = {
      quickSearch: async () => ({ results: [] }),
      listDocuments: async () => ({ documents: [] }),
      searchDocuments: async () => ({ hits: [], total: 0 }),
    };

    const mockDb = {
      isUserAuthorizedForCampaign: async () => true,
      getUserAllowedCampaigns: async () => [],
    };

    app.use(
      '/api',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createDocumentRoutes(mockClient as any, true, mockDb as any),
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

  it('safely handles array tampering for query parameter', async () => {
    const baseUrl = await startApp();
    const response = await fetch(`${baseUrl}/api/search?query[]=a&query[]=b`);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Search query is required',
    });
  });

  it('safely handles array tampering for quick search query parameter', async () => {
    const baseUrl = await startApp();
    const response = await fetch(
      `${baseUrl}/api/search/quick?query[]=a&query[]=b`,
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Search query is required',
    });
  });
});
