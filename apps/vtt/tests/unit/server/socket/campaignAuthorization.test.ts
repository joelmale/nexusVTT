import { describe, it, expect } from 'vitest';
import { authorizeCampaignHost } from '../../../../server/socket/campaignAuthorization.js';
import type { CampaignRecord } from '../../../../server/repositories/base.js';

describe('authorizeCampaignHost', () => {
  const campaign: CampaignRecord = {
    id: 'camp-1',
    name: 'Campaign 1',
    description: null,
    dmId: 'dm-user-123',
    scenes: [],
    lastRoomCode: null,
    lastRoomCodeUpdatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('returns true when userId matches the campaign dmId', () => {
    expect(authorizeCampaignHost('dm-user-123', campaign)).toBe(true);
  });

  it('returns false when userId does not match campaign dmId', () => {
    expect(authorizeCampaignHost('random-player', campaign)).toBe(false);
  });
});
