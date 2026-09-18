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

describe('enabled document routes CRUD and authorization', () => {
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

  const mockPublicDoc = {
    id: 'doc-public',
    title: 'Public SRD Rulebook',
    description: 'Public Rules',
    type: 'rulebook' as const,
    format: 'markdown' as const,
    storageKey: 'storage/rules.md',
    fileSize: 1024,
    uploadedBy: 'other-user',
    tags: ['srd'],
    collections: [],
    campaigns: [],
    isPublic: true,
    metadata: {},
    uploadedAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrivateDoc = {
    id: 'doc-private',
    title: 'Secret DM Notes',
    description: 'Campaign Secrets',
    type: 'campaign_note' as const,
    format: 'markdown' as const,
    storageKey: 'storage/secret.md',
    fileSize: 512,
    uploadedBy: 'dm-user',
    tags: ['secret'],
    collections: [],
    campaigns: ['campaign-private'],
    isPublic: false,
    metadata: {},
    uploadedAt: new Date(),
    updatedAt: new Date(),
  };

  const mockOwnedDoc = {
    id: 'doc-owned',
    title: 'My Custom Handout',
    description: 'Player Note',
    type: 'handout' as const,
    format: 'pdf' as const,
    storageKey: 'storage/handout.pdf',
    fileSize: 2048,
    uploadedBy: 'test-user-1',
    tags: ['handout'],
    collections: [],
    campaigns: [],
    isPublic: false,
    metadata: {},
    uploadedAt: new Date(),
    updatedAt: new Date(),
  };

  async function startCustomApp(options: {
    authenticated?: boolean;
    userId?: string;
    clientOverrides?: Record<string, unknown>;
    dbOverrides?: Record<string, unknown>;
  } = {}): Promise<string> {
    const {
      authenticated = true,
      userId = 'test-user-1',
      clientOverrides = {},
      dbOverrides = {},
    } = options;

    const app: Express = express();
    app.use(express.json());

    app.use((req, _res, next) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = req as any;
      if (authenticated) {
        r.session = {
          guestUser: { id: userId, name: 'Tester', provider: 'guest' },
        };
        r.isAuthenticated = () => true;
        r.user = { id: userId };
      } else {
        r.session = {};
        r.isAuthenticated = () => false;
        r.user = undefined;
      }
      next();
    });

    const mockClient = {
      createDocument: async (body: unknown, authorId: string) => ({
        document: { ...mockOwnedDoc, ...(body as object), uploadedBy: authorId },
        uploadUrl: 'https://upload.nexusvtt.test/signed',
      }),
      listDocuments: async () => ({
        documents: [mockPublicDoc, mockPrivateDoc, mockOwnedDoc],
        pagination: { total: 3, limit: 10, skip: 0 },
      }),
      getDocument: async (id: string) => {
        if (id === mockPublicDoc.id) return mockPublicDoc;
        if (id === mockPrivateDoc.id) return mockPrivateDoc;
        if (id === mockOwnedDoc.id) return mockOwnedDoc;
        throw new Error(`Document not found: ${id}`);
      },
      updateDocument: async (id: string, updates: unknown) => ({
        ...mockOwnedDoc,
        id,
        ...(updates as object),
      }),
      deleteDocument: async (_id: string) => undefined,
      getDocumentContentUrl: (id: string) =>
        `https://cdn.nexusvtt.test/documents/${id}/content`,
      quickSearch: async () => ({
        results: [{ documentId: mockPublicDoc.id, snippet: 'quick snippet' }],
      }),
      searchDocuments: async () => ({
        results: [{ documentId: mockPublicDoc.id, snippet: 'search snippet' }],
        total: 1,
      }),
      ask: async (question: string) => ({
        answer: `Answer for: ${question}`,
        citations: [{ documentId: mockPublicDoc.id, sourceIndex: 1 }],
        snippets: ['grounded text'],
      }),
      ...clientOverrides,
    };

    const mockDb = {
      isUserAuthorizedForCampaign: async (_u: string, campaignId: string) =>
        campaignId === 'campaign-allowed',
      getCampaignsByUser: async () => [{ id: 'campaign-allowed' }],
      ...dbOverrides,
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

  it('generates ws-token when authenticated and rejects when unauthenticated', async () => {
    const authUrl = await startCustomApp({ authenticated: true });
    const authRes = await fetch(`${authUrl}/api/documents/ws-token`);
    expect(authRes.status).toBe(200);
    const authJson = (await authRes.json()) as { token: string };
    expect(authJson.token).toBeDefined();

    const unauthUrl = await startCustomApp({ authenticated: false });
    const unauthRes = await fetch(`${unauthUrl}/api/documents/ws-token`);
    expect(unauthRes.status).toBe(401);
  });

  it('creates document and returns signed upload url when authorized', async () => {
    const baseUrl = await startCustomApp();
    const res = await fetch(`${baseUrl}/api/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'New Map Document',
        type: 'map',
        format: 'markdown',
        campaigns: ['campaign-allowed'],
      }),
    });

    expect(res.status).toBe(201);
    const data = (await res.json()) as { document: { title: string }; uploadUrl: string };
    expect(data.document.title).toBe('New Map Document');
    expect(data.uploadUrl).toBe('https://upload.nexusvtt.test/signed');
  });

  it('rejects document creation when user lacks authorization for campaign', async () => {
    const baseUrl = await startCustomApp();
    const res = await fetch(`${baseUrl}/api/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Unauthorized Map',
        type: 'map',
        format: 'markdown',
        campaigns: ['campaign-forbidden'],
      }),
    });

    expect(res.status).toBe(403);
    const err = (await res.json()) as { error: string };
    expect(err.error).toContain('Access denied');
  });

  it('lists documents post-filtered by user access', async () => {
    const baseUrl = await startCustomApp({ userId: 'test-user-1' });
    const res = await fetch(`${baseUrl}/api/documents`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { documents: Array<{ id: string }> };

    // Should include public doc and owned doc, but NOT private doc (uploaded by dm-user and campaign not allowed)
    const docIds = data.documents.map((d) => d.id);
    expect(docIds).toContain('doc-public');
    expect(docIds).toContain('doc-owned');
    expect(docIds).not.toContain('doc-private');
  });

  it('fetches document by id respecting public, owned, and forbidden access', async () => {
    const baseUrl = await startCustomApp({ userId: 'test-user-1' });

    // Public document -> accessible
    const publicRes = await fetch(`${baseUrl}/api/documents/doc-public`);
    expect(publicRes.status).toBe(200);

    // Owned document -> accessible
    const ownedRes = await fetch(`${baseUrl}/api/documents/doc-owned`);
    expect(ownedRes.status).toBe(200);

    // Private document owned by dm-user -> 403
    const privateRes = await fetch(`${baseUrl}/api/documents/doc-private`);
    expect(privateRes.status).toBe(403);

    // Non-existent document -> 404
    const notFoundRes = await fetch(`${baseUrl}/api/documents/doc-missing`);
    expect(notFoundRes.status).toBe(404);
  });

  it('returns document content URL for authorized user and 403 for unauthorized', async () => {
    const baseUrl = await startCustomApp({ userId: 'test-user-1' });

    const contentRes = await fetch(`${baseUrl}/api/documents/doc-owned/content`);
    expect(contentRes.status).toBe(200);
    const data = (await contentRes.json()) as { contentUrl: string };
    expect(data.contentUrl).toContain('doc-owned/content');

    const forbiddenRes = await fetch(`${baseUrl}/api/documents/doc-private/content`);
    expect(forbiddenRes.status).toBe(403);
  });

  it('allows owner to update and delete document, and rejects non-owner', async () => {
    const baseUrl = await startCustomApp({ userId: 'test-user-1' });

    // Owner updates owned doc -> 200
    const updateRes = await fetch(`${baseUrl}/api/documents/doc-owned`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated Title' }),
    });
    expect(updateRes.status).toBe(200);

    // Non-owner updates public doc -> 403
    const updateForbiddenRes = await fetch(`${baseUrl}/api/documents/doc-public`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Hacked Title' }),
    });
    expect(updateForbiddenRes.status).toBe(403);

    // Non-owner deletes public doc -> 403
    const deleteForbiddenRes = await fetch(`${baseUrl}/api/documents/doc-public`, {
      method: 'DELETE',
    });
    expect(deleteForbiddenRes.status).toBe(403);

    // Owner deletes owned doc -> 204
    const deleteRes = await fetch(`${baseUrl}/api/documents/doc-owned`, {
      method: 'DELETE',
    });
    expect(deleteRes.status).toBe(204);
  });

  it('handles question answering endpoint with validation and citations', async () => {
    const baseUrl = await startCustomApp();

    // Missing question -> 400
    const invalidRes = await fetch(`${baseUrl}/api/search/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(invalidRes.status).toBe(400);

    // Valid question -> 200 with filtered citations
    const askRes = await fetch(`${baseUrl}/api/search/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'What are the rules?' }),
    });
    expect(askRes.status).toBe(200);
    const askData = (await askRes.json()) as { answer: string; citations: Array<{ documentId: string }> };
    expect(askData.answer).toContain('What are the rules?');
    expect(askData.citations).toHaveLength(1);
    expect(askData.citations[0].documentId).toBe('doc-public');
  });
});

