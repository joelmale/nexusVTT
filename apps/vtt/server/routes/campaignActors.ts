import type express from 'express';
import { domainCommandSchema } from '@nexus/game-contracts';
import type { DatabaseService } from '../database.js';
import type { SocketManager } from '../socket/SocketManager.js';
import { bundledSpellDefinitions } from '../services/characterActorProjection.js';
import {
  createHandoutUrlResolver,
  type HandoutUrlResolver,
} from './handoutAssetUrl.js';

type SocketManagerProvider = () => Pick<SocketManager, 'broadcastToRoom'>;

function invalidateCampaignActors(
  getSocketManager: SocketManagerProvider | undefined,
  roomId: string | undefined,
  campaignId: string,
  versions: Record<string, number>,
) {
  if (!getSocketManager || !roomId || !Object.keys(versions).length) return;
  try {
    // This is an ephemeral invalidation after commit, never a canonical patch.
    getSocketManager().broadcastToRoom(roomId, {
      type: 'event',
      data: { name: 'actor/state-changed', campaignId, versions },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error(
      'Could not notify clients of committed actor changes:',
      error,
    );
  }
}

function requestRoomId(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function broadcastRevealHandout(
  getSocketManager: SocketManagerProvider | undefined,
  roomId: string | undefined,
  command: ReturnType<typeof domainCommandSchema.parse>,
  duplicate: boolean | undefined,
  resolveHandoutUrl: HandoutUrlResolver,
): Promise<void> {
  if (
    !getSocketManager ||
    !roomId ||
    duplicate ||
    command.payload.type !== 'RevealHandout'
  ) {
    return;
  }

  // Simple Player Mode shows the handout image; full mode keeps the toast.
  const url = await resolveHandoutUrl(
    command.issuerUserId,
    command.payload.assetRef.assetId,
  );

  getSocketManager().broadcastToRoom(roomId, {
    type: 'event',
    data: {
      name: 'handout/revealed',
      assetRef: command.payload.assetRef,
      commandId: command.commandId,
      revealedBy: command.issuerUserId,
      stepId: command.payload.stepId,
      title: command.payload.title,
      ...(url ? { url } : {}),
    },
    timestamp: Date.now(),
  });
}

export function registerCampaignActorRoutes(
  app: express.Application,
  db: DatabaseService,
  getSocketManager?: SocketManagerProvider,
  resolveHandoutUrl: HandoutUrlResolver = createHandoutUrlResolver(),
): void {
  async function authorize(
    req: express.Request,
    res: express.Response,
    campaignId: string,
    issuerId?: string,
  ) {
    const accountId = req.isAuthenticated?.()
      ? (req.user as { id?: string } | undefined)?.id
      : undefined;
    const guestId = (
      req.session as unknown as { guestUser?: { id?: string } } | undefined
    )?.guestUser?.id;
    const principalId = accountId ?? guestId;
    if (!principalId) {
      res.status(401).json({ error: 'Authentication required.' });
      return null;
    }
    if (issuerId && issuerId !== principalId) {
      res
        .status(403)
        .json({ error: 'Command issuer must match the session identity.' });
      return null;
    }
    const campaign = await db.getCampaignById(campaignId);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found.' });
      return null;
    }
    const isDm = campaign.dmId === principalId;
    if (
      !isDm &&
      !(await db.isUserAuthorizedForCampaign(principalId, campaignId))
    ) {
      res.status(403).json({ error: 'Campaign access required.' });
      return null;
    }
    return { principalId, isDm, campaign };
  }
  app.get('/api/campaigns/:campaignId/encounters/:runId', async (req, res) => {
    try {
      const campaignId = req.params.campaignId;
      const access = await authorize(req, res, campaignId);
      if (!access) return;
      if (!access.isDm)
        return res
          .status(403)
          .json({
            error: 'Only the campaign DM can inspect a prepared encounter.',
          });
      const run = await db.encounterRuns.getRunById(req.params.runId);
      if (!run || run.campaignId !== campaignId)
        return res.status(404).json({ error: 'Encounter run not found.' });
      const participants = Array.isArray(run.participants)
        ? (run.participants as Array<{ actorId?: string }>)
        : [];
      const ids = new Set(participants.map((entry) => entry.actorId));
      const actors = (
        await db.campaignActors.getActorsByCampaign(campaignId)
      ).filter((actor) => ids.has(actor.id));
      return res.json({ run, actors });
    } catch (error) {
      console.error('Could not load encounter run:', error);
      return res.status(500).json({ error: 'Could not load encounter run.' });
    }
  });
  app.get('/api/campaigns/:campaignId/spells', async (req, res) => {
    const principalId = req.isAuthenticated?.()
      ? (req.user as { id?: string } | undefined)?.id
      : undefined;
    const guestId = (
      req.session as unknown as { guestUser?: { id?: string } } | undefined
    )?.guestUser?.id;
    const userId = principalId ?? guestId;
    if (!userId)
      return res.status(401).json({ error: 'Authentication required.' });
    try {
      const campaign = await db.getCampaignById(req.params.campaignId);
      if (!campaign)
        return res.status(404).json({ error: 'Campaign not found.' });
      if (
        campaign.dmId !== userId &&
        !(await db.isUserAuthorizedForCampaign(userId, campaign.id))
      ) {
        return res.status(403).json({ error: 'Campaign access required.' });
      }
      const spells = bundledSpellDefinitions(
        campaign.id,
        campaign.dmId,
        campaign.edition === '2014' ? '2014' : '2024',
      );
      const stored = await db.libraryObjects.listObjects({
        campaignId: campaign.id,
        kind: 'spell',
      });
      for (const record of stored) {
        const revision = await db.libraryObjects.getRevision(
          record.id,
          record.currentRevision,
        );
        if (revision) {
          const definition = revision.data as (typeof spells)[number];
          const index = spells.findIndex((spell) => spell.id === definition.id);
          if (index >= 0) spells[index] = definition;
          else spells.push(definition);
        }
      }
      return res.json({ spells });
    } catch (error) {
      console.error('Failed to load campaign spells:', error);
      return res.status(500).json({ error: 'Failed to load campaign spells.' });
    }
  });
  /**
   * GET /api/campaigns/:campaignId/actors
   * Retrieve all canonical actors associated with a campaign
   */
  app.get('/api/campaigns/:campaignId/actors', async (req, res) => {
    try {
      const { campaignId } = req.params;
      if (!(await authorize(req, res, campaignId))) return;
      if (!campaignId) {
        return res
          .status(400)
          .json({ error: 'campaignId parameter is required' });
      }

      const actors = await db.campaignActors.getActorsByCampaign(campaignId);
      res.json(actors);
    } catch (error) {
      console.error('Failed to fetch campaign actors:', error);
      res.status(500).json({ error: 'Failed to fetch campaign actors' });
    }
  });

  /**
   * GET /api/campaigns/:campaignId/actors/:actorId
   * Retrieve a specific actor by ID within a campaign
   */
  app.get('/api/campaigns/:campaignId/actors/:actorId', async (req, res) => {
    try {
      const { campaignId, actorId } = req.params;
      if (!(await authorize(req, res, campaignId))) return;
      const actor = await db.campaignActors.getActorById(actorId);

      if (!actor || actor.campaignId !== campaignId) {
        return res.status(404).json({ error: 'Actor not found in campaign' });
      }

      res.json(actor);
    } catch (error) {
      console.error('Failed to fetch actor:', error);
      res.status(500).json({ error: 'Failed to fetch actor' });
    }
  });

  /**
   * POST /api/campaigns/:campaignId/commands
   * Execute an authoritative domain command (e.g. ApplyDamage, HealActor, AdmitCharacter)
   */
  app.post('/api/campaigns/:campaignId/commands', async (req, res) => {
    try {
      const { campaignId } = req.params;

      const parseResult = domainCommandSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: 'Invalid domain command envelope',
          details: parseResult.error.issues,
        });
      }

      const command = parseResult.data;
      if (command.campaignId !== campaignId) {
        return res.status(400).json({
          error: `Mismatched campaignId in route (${campaignId}) and payload (${command.campaignId})`,
        });
      }

      const access = await authorize(
        req,
        res,
        command.campaignId,
        command.issuerUserId,
      );
      if (!access) return;

      const { receipt, duplicate } = await db.domainCommands.execute(command, {
        principalId: access.principalId,
        isDm: access.isDm,
        roomId: requestRoomId(req.headers['x-room-id']),
      });

      if (!receipt.result.success) {
        // CAS version conflict or rule rejection
        return res.status(409).json({
          success: false,
          error: receipt.result.error || 'Command version conflict',
          receipt,
        });
      }

      await broadcastRevealHandout(
        getSocketManager,
        requestRoomId(req.headers['x-room-id']),
        command,
        duplicate,
        resolveHandoutUrl,
      );

      invalidateCampaignActors(
        getSocketManager,
        requestRoomId(req.headers['x-room-id']),
        command.campaignId,
        receipt.result.committedVersions ?? {},
      );

      res.status(200).json({
        success: true,
        duplicate,
        receipt,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown command execution error';
      console.error('Domain command execution failed:', error);
      res.status(500).json({ error: message });
    }
  });

  /**
   * POST /api/commands
   * Direct domain command endpoint
   */
  app.post('/api/commands', async (req, res) => {
    try {
      const parseResult = domainCommandSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: 'Invalid domain command envelope',
          details: parseResult.error.issues,
        });
      }

      const command = parseResult.data;
      const access = await authorize(
        req,
        res,
        command.campaignId,
        command.issuerUserId,
      );
      if (!access) return;

      const { receipt, duplicate } = await db.domainCommands.execute(command, {
        principalId: access.principalId,
        isDm: access.isDm,
        roomId: requestRoomId(req.headers['x-room-id']),
      });

      if (!receipt.result.success) {
        return res.status(409).json({
          success: false,
          error: receipt.result.error || 'Command version conflict',
          receipt,
        });
      }

      await broadcastRevealHandout(
        getSocketManager,
        requestRoomId(req.headers['x-room-id']),
        command,
        duplicate,
        resolveHandoutUrl,
      );

      invalidateCampaignActors(
        getSocketManager,
        requestRoomId(req.headers['x-room-id']),
        command.campaignId,
        receipt.result.committedVersions ?? {},
      );

      res.status(200).json({
        success: true,
        duplicate,
        receipt,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown command execution error';
      console.error('Domain command execution failed:', error);
      res.status(500).json({ error: message });
    }
  });
}
