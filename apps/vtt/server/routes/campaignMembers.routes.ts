import { Router, type Request, type Response } from 'express';

import type { DatabaseService } from '../database.js';
import { requireAuthenticatedNonGuest } from '../middleware/assetWriteGuard.js';
import type { CampaignAccess } from '../repositories/base.js';

interface CampaignMembersRouterOptions {
  db: Pick<DatabaseService, 'campaigns'>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function routeParameter(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function sessionUserId(req: Request): string | null {
  const user = req.user as { id?: unknown } | undefined;
  return typeof user?.id === 'string' ? user.id : null;
}

/**
 * Campaign co-DM membership. Any member can see who else edits the campaign;
 * only the owner can invite or remove co-DMs. Invites name an existing,
 * non-guest Nexus account by email.
 */
export function createCampaignMembersRouter({
  db,
}: CampaignMembersRouterOptions): Router {
  const router = Router();

  /** Sends the error response and returns null unless the user is a member. */
  async function authorize(
    req: Request,
    res: Response,
  ): Promise<(CampaignAccess & { userId: string }) | null> {
    const userId = sessionUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'User ID not found in session' });
      return null;
    }
    const campaignId = routeParameter(req.params.campaignId);
    if (!UUID_PATTERN.test(campaignId)) {
      res.status(400).json({ error: 'campaignId must be a valid UUID' });
      return null;
    }
    const access = await db.campaigns.getCampaignAccess(campaignId, userId);
    if (!access) {
      res.status(404).json({ error: 'Campaign not found' });
      return null;
    }
    if (!access.role) {
      res.status(403).json({ error: 'Campaign DM access required' });
      return null;
    }
    return { ...access, userId };
  }

  router.use('/campaigns/:campaignId/members', requireAuthenticatedNonGuest);

  router.get('/campaigns/:campaignId/members', async (req, res) => {
    try {
      const access = await authorize(req, res);
      if (!access) return;
      const members = await db.campaigns.listCampaignMembers(
        access.campaign.id,
      );
      return res.json({ role: access.role, members });
    } catch (error) {
      console.error('Failed to list campaign members:', error);
      return res.status(500).json({ error: 'Failed to list campaign members' });
    }
  });

  router.post('/campaigns/:campaignId/members', async (req, res) => {
    try {
      const access = await authorize(req, res);
      if (!access) return;
      if (access.role !== 'owner') {
        return res
          .status(403)
          .json({ error: 'Only the campaign owner can invite co-DMs' });
      }
      const body = (req.body ?? {}) as { email?: unknown };
      const email = typeof body.email === 'string' ? body.email.trim() : '';
      if (!EMAIL_PATTERN.test(email) || email.length > 255) {
        return res.status(400).json({ error: 'Enter a valid email address.' });
      }
      const invitee = await db.campaigns.findInvitableUserByEmail(email);
      if (!invitee) {
        return res.status(404).json({
          error:
            'No Nexus account uses that email. Ask them to sign in once first.',
        });
      }
      if (invitee.id === access.campaign.dmId) {
        return res
          .status(409)
          .json({ error: 'You already own this campaign.' });
      }
      const added = await db.campaigns.addCampaignMember(
        access.campaign.id,
        invitee.id,
        'co-dm',
        access.userId,
      );
      if (!added) {
        return res
          .status(409)
          .json({ error: 'That account is already a co-DM.' });
      }
      const members = await db.campaigns.listCampaignMembers(
        access.campaign.id,
      );
      return res.status(201).json({ role: access.role, members });
    } catch (error) {
      console.error('Failed to invite campaign member:', error);
      return res.status(500).json({ error: 'Failed to invite co-DM' });
    }
  });

  router.delete(
    '/campaigns/:campaignId/members/:userId',
    async (req, res) => {
      try {
        const access = await authorize(req, res);
        if (!access) return;
        if (access.role !== 'owner') {
          return res
            .status(403)
            .json({ error: 'Only the campaign owner can remove co-DMs' });
        }
        const memberId = routeParameter(req.params.userId);
        if (!UUID_PATTERN.test(memberId)) {
          return res.status(400).json({ error: 'userId must be a valid UUID' });
        }
        const removed = await db.campaigns.removeCampaignMember(
          access.campaign.id,
          memberId,
        );
        if (!removed) {
          return res.status(404).json({ error: 'Co-DM not found' });
        }
        const members = await db.campaigns.listCampaignMembers(
          access.campaign.id,
        );
        return res.json({ role: access.role, members });
      } catch (error) {
        console.error('Failed to remove campaign member:', error);
        return res.status(500).json({ error: 'Failed to remove co-DM' });
      }
    },
  );

  return router;
}
