import express, { type Express } from 'express';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createCampaignMembersRouter } from '../../../../server/routes/campaignMembers.routes.js';

const CAMPAIGN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const CO_DM_ID = '22222222-2222-4222-8222-222222222222';
const STRANGER_ID = '33333333-3333-4333-8333-333333333333';
const INVITEE_ID = '44444444-4444-4444-8444-444444444444';

describe('campaign member routes', () => {
  let app: Express;
  let baseUrl: string;
  let server: Server;
  let userId = OWNER_ID;
  let provider = 'google';
  let campaigns: {
    getCampaignAccess: ReturnType<typeof vi.fn>;
    listCampaignMembers: ReturnType<typeof vi.fn>;
    findInvitableUserByEmail: ReturnType<typeof vi.fn>;
    addCampaignMember: ReturnType<typeof vi.fn>;
    removeCampaignMember: ReturnType<typeof vi.fn>;
  };

  const membersUrl = () => `${baseUrl}/api/campaigns/${CAMPAIGN_ID}/members`;
  const invite = (email: unknown) =>
    fetch(membersUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

  beforeEach(async () => {
    userId = OWNER_ID;
    provider = 'google';
    campaigns = {
      getCampaignAccess: vi.fn(async (campaignId: string, caller: string) =>
        campaignId === CAMPAIGN_ID
          ? {
              campaign: { id: CAMPAIGN_ID, dmId: OWNER_ID },
              role:
                caller === OWNER_ID
                  ? 'owner'
                  : caller === CO_DM_ID
                    ? 'co-dm'
                    : null,
            }
          : null,
      ),
      listCampaignMembers: vi.fn().mockResolvedValue([
        { userId: OWNER_ID, role: 'owner' },
        { userId: CO_DM_ID, role: 'co-dm' },
      ]),
      findInvitableUserByEmail: vi.fn().mockResolvedValue({ id: INVITEE_ID }),
      addCampaignMember: vi.fn().mockResolvedValue(true),
      removeCampaignMember: vi.fn().mockResolvedValue(true),
    };

    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.isAuthenticated = () => true;
      req.user = { id: userId, provider } as Express.User;
      next();
    });
    app.use('/api', createCampaignMembersRouter({ db: { campaigns } as never }));

    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected a TCP listener');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('lists members for the owner and co-DMs only', async () => {
    let response = await fetch(membersUrl());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      role: 'owner',
      members: [{ userId: OWNER_ID }, { userId: CO_DM_ID }],
    });

    userId = CO_DM_ID;
    response = await fetch(membersUrl());
    expect(response.status).toBe(200);
    expect((await response.json()).role).toBe('co-dm');

    userId = STRANGER_ID;
    expect((await fetch(membersUrl())).status).toBe(403);
  });

  it('rejects guests and unknown campaigns', async () => {
    provider = 'guest';
    expect((await fetch(membersUrl())).status).toBe(403);

    provider = 'google';
    const missing = await fetch(
      `${baseUrl}/api/campaigns/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/members`,
    );
    expect(missing.status).toBe(404);
    expect(
      (await fetch(`${baseUrl}/api/campaigns/not-a-uuid/members`)).status,
    ).toBe(400);
  });

  it('lets the owner invite an existing account by email', async () => {
    const response = await invite('  Friend@Example.com ');
    expect(response.status).toBe(201);
    expect(campaigns.findInvitableUserByEmail).toHaveBeenCalledWith(
      'Friend@Example.com',
    );
    expect(campaigns.addCampaignMember).toHaveBeenCalledWith(
      CAMPAIGN_ID,
      INVITEE_ID,
      'co-dm',
      OWNER_ID,
    );
  });

  it('explains invites that cannot be added', async () => {
    expect((await invite('not-an-email')).status).toBe(400);

    campaigns.findInvitableUserByEmail.mockResolvedValueOnce(null);
    expect((await invite('nobody@example.com')).status).toBe(404);

    campaigns.findInvitableUserByEmail.mockResolvedValueOnce({ id: OWNER_ID });
    expect((await invite('me@example.com')).status).toBe(409);

    campaigns.addCampaignMember.mockResolvedValueOnce(false);
    expect((await invite('friend@example.com')).status).toBe(409);
  });

  it('does not let co-DMs manage members', async () => {
    userId = CO_DM_ID;
    expect((await invite('friend@example.com')).status).toBe(403);
    const removal = await fetch(`${membersUrl()}/${CO_DM_ID}`, {
      method: 'DELETE',
    });
    expect(removal.status).toBe(403);
    expect(campaigns.addCampaignMember).not.toHaveBeenCalled();
    expect(campaigns.removeCampaignMember).not.toHaveBeenCalled();
  });

  it('lets the owner remove a co-DM', async () => {
    let response = await fetch(`${membersUrl()}/${CO_DM_ID}`, {
      method: 'DELETE',
    });
    expect(response.status).toBe(200);
    expect(campaigns.removeCampaignMember).toHaveBeenCalledWith(
      CAMPAIGN_ID,
      CO_DM_ID,
    );

    campaigns.removeCampaignMember.mockResolvedValueOnce(false);
    response = await fetch(`${membersUrl()}/${INVITEE_ID}`, {
      method: 'DELETE',
    });
    expect(response.status).toBe(404);
  });
});
