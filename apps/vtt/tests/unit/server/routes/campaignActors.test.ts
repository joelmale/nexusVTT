import express, { type Express } from 'express';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../../../../server/database.js';
import { registerCampaignActorRoutes } from '../../../../server/routes/campaignActors.js';
import type { DomainCommand } from '@nexus/game-contracts';

interface AppContext {
  baseUrl: string;
  server: Server;
  db: {
    campaignActors: {
      getActorsByCampaign: ReturnType<typeof vi.fn>;
      getActorById: ReturnType<typeof vi.fn>;
    };
    domainCommands: {
      execute: ReturnType<typeof vi.fn>;
    };
  };
}

async function startApp(): Promise<AppContext> {
  const db = {
    campaignActors: {
      getActorsByCampaign: vi.fn(),
      getActorById: vi.fn(),
    },
    domainCommands: {
      execute: vi.fn(),
    },
  };

  const app: Express = express();
  app.use(express.json());

  app.use((req, _res, next) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).isAuthenticated = () => true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).user = { id: 'test-user-1' };
    next();
  });

  registerCampaignActorRoutes(app, db as unknown as DatabaseService);

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected server to listen on TCP port');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server,
    db,
  };
}

describe('campaignActors routes', () => {
  let ctx: AppContext | null = null;

  afterEach(async () => {
    if (ctx) {
      await new Promise<void>((resolve) => ctx!.server.close(() => resolve()));
      ctx = null;
    }
  });

  const validCampaignId = '11111111-1111-4111-8111-111111111111';
  const validActorId = '22222222-2222-4222-8222-222222222222';
  const validCommandId = '33333333-3333-4333-8333-333333333333';

  describe('GET /api/campaigns/:campaignId/actors', () => {
    it('returns actors list for campaign', async () => {
      ctx = await startApp();
      const mockActors = [
        { id: validActorId, name: 'Valeros', campaignId: validCampaignId },
      ];
      ctx.db.campaignActors.getActorsByCampaign.mockResolvedValueOnce(mockActors);

      const res = await fetch(`${ctx.baseUrl}/api/campaigns/${validCampaignId}/actors`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(mockActors);
      expect(ctx.db.campaignActors.getActorsByCampaign).toHaveBeenCalledWith(validCampaignId);
    });

    it('returns 500 when repository throws error', async () => {
      ctx = await startApp();
      ctx.db.campaignActors.getActorsByCampaign.mockRejectedValueOnce(new Error('DB error'));

      const res = await fetch(`${ctx.baseUrl}/api/campaigns/${validCampaignId}/actors`);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('Failed to fetch campaign actors');
    });
  });

  describe('GET /api/campaigns/:campaignId/actors/:actorId', () => {
    it('returns actor when found in campaign', async () => {
      ctx = await startApp();
      const mockActor = { id: validActorId, name: 'Valeros', campaignId: validCampaignId };
      ctx.db.campaignActors.getActorById.mockResolvedValueOnce(mockActor);

      const res = await fetch(
        `${ctx.baseUrl}/api/campaigns/${validCampaignId}/actors/${validActorId}`,
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(mockActor);
    });

    it('returns 404 when actor is not found', async () => {
      ctx = await startApp();
      ctx.db.campaignActors.getActorById.mockResolvedValueOnce(null);

      const res = await fetch(
        `${ctx.baseUrl}/api/campaigns/${validCampaignId}/actors/${validActorId}`,
      );
      expect(res.status).toBe(404);
    });

    it('returns 404 when actor belongs to different campaign', async () => {
      ctx = await startApp();
      ctx.db.campaignActors.getActorById.mockResolvedValueOnce({
        id: validActorId,
        campaignId: '99999999-9999-4999-8999-999999999999',
      });

      const res = await fetch(
        `${ctx.baseUrl}/api/campaigns/${validCampaignId}/actors/${validActorId}`,
      );
      expect(res.status).toBe(404);
    });

    it('returns 500 when query fails', async () => {
      ctx = await startApp();
      ctx.db.campaignActors.getActorById.mockRejectedValueOnce(new Error('DB error'));

      const res = await fetch(
        `${ctx.baseUrl}/api/campaigns/${validCampaignId}/actors/${validActorId}`,
      );
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/campaigns/:campaignId/commands', () => {
    const validCommand: DomainCommand = {
      commandId: validCommandId,
      protocolVersion: '1.0',
      campaignId: validCampaignId,
      issuerUserId: 'test-user-1',
      timestamp: new Date().toISOString(),
      expectedActorVersions: { [validActorId]: 1 },
      payload: {
        type: 'ApplyDamage',
        targetActorId: validActorId,
        amount: 10,
        damageType: 'fire',
      },
    };

    it('successfully executes valid command', async () => {
      ctx = await startApp();
      const mockReceipt = {
        commandId: validCommandId,
        principalId: 'test-user-1',
        campaignId: validCampaignId,
        payloadHash: 'hash-abc',
        committedAt: new Date().toISOString(),
        result: {
          success: true,
          committedVersions: { [validActorId]: 2 },
          eventSequence: 1,
        },
      };
      ctx.db.domainCommands.execute.mockResolvedValueOnce({
        receipt: mockReceipt,
        duplicate: false,
      });

      const res = await fetch(`${ctx.baseUrl}/api/campaigns/${validCampaignId}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validCommand),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.receipt).toEqual(mockReceipt);
    });

    it('returns 400 when payload validation fails', async () => {
      ctx = await startApp();
      const res = await fetch(`${ctx.baseUrl}/api/campaigns/${validCampaignId}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid: 'payload' }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid domain command envelope');
    });

    it('returns 400 when route campaignId and envelope campaignId do not match', async () => {
      ctx = await startApp();
      const mismatchedCommand = {
        ...validCommand,
        campaignId: '99999999-9999-4999-8999-999999999999',
      };

      const res = await fetch(`${ctx.baseUrl}/api/campaigns/${validCampaignId}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mismatchedCommand),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Mismatched campaignId');
    });

    it('returns 409 on version conflict', async () => {
      ctx = await startApp();
      const conflictReceipt = {
        commandId: validCommandId,
        principalId: 'test-user-1',
        campaignId: validCampaignId,
        payloadHash: 'hash-abc',
        committedAt: new Date().toISOString(),
        result: {
          success: false,
          error: 'State version mismatch: expected 1, got 2',
        },
      };
      ctx.db.domainCommands.execute.mockResolvedValueOnce({
        receipt: conflictReceipt,
        duplicate: false,
      });

      const res = await fetch(`${ctx.baseUrl}/api/campaigns/${validCampaignId}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validCommand),
      });

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('State version mismatch');
    });
  });

  describe('POST /api/commands', () => {
    it('executes command directly', async () => {
      ctx = await startApp();
      const validCommand: DomainCommand = {
        commandId: validCommandId,
        protocolVersion: '1.0',
        campaignId: validCampaignId,
        issuerUserId: 'test-user-1',
        timestamp: new Date().toISOString(),
        expectedActorVersions: {},
        payload: {
          type: 'HealActor',
          targetActorId: validActorId,
          amount: 5,
        },
      };
      const mockReceipt = {
        commandId: validCommandId,
        principalId: 'test-user-1',
        campaignId: validCampaignId,
        payloadHash: 'hash-xyz',
        committedAt: new Date().toISOString(),
        result: { success: true },
      };
      ctx.db.domainCommands.execute.mockResolvedValueOnce({
        receipt: mockReceipt,
        duplicate: false,
      });

      const res = await fetch(`${ctx.baseUrl}/api/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validCommand),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });
});
