import type express from 'express';
import { domainCommandSchema } from '@nexus/game-contracts';
import type { DatabaseService } from '../database.js';

export function registerCampaignActorRoutes(
  app: express.Application,
  db: DatabaseService,
): void {
  /**
   * GET /api/campaigns/:campaignId/actors
   * Retrieve all canonical actors associated with a campaign
   */
  app.get('/api/campaigns/:campaignId/actors', async (req, res) => {
    try {
      const { campaignId } = req.params;
      if (!campaignId) {
        return res.status(400).json({ error: 'campaignId parameter is required' });
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

      const user = req.user as { id?: string } | undefined;
      const principalId = user?.id || command.issuerUserId;

      const { receipt, duplicate } = await db.domainCommands.execute(command, {
        principalId,
        isDm: true, // In active campaign session, DM or permitted user
        roomId: req.headers['x-room-id'] as string | undefined,
      });

      if (!receipt.result.success) {
        // CAS version conflict or rule rejection
        return res.status(409).json({
          success: false,
          error: receipt.result.error || 'Command version conflict',
          receipt,
        });
      }

      res.status(200).json({
        success: true,
        duplicate,
        receipt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown command execution error';
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
      const user = req.user as { id?: string } | undefined;
      const principalId = user?.id || command.issuerUserId;

      const { receipt, duplicate } = await db.domainCommands.execute(command, {
        principalId,
        isDm: true,
        roomId: req.headers['x-room-id'] as string | undefined,
      });

      if (!receipt.result.success) {
        return res.status(409).json({
          success: false,
          error: receipt.result.error || 'Command version conflict',
          receipt,
        });
      }

      res.status(200).json({
        success: true,
        duplicate,
        receipt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown command execution error';
      console.error('Domain command execution failed:', error);
      res.status(500).json({ error: message });
    }
  });
}
