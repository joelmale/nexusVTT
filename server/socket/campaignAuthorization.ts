import { CampaignRecord } from '../repositories/base.js';

/**
 * Strictly validates if a user is the primary host of a campaign.
 * Unlike broader room checks, this ensures only the campaign owner
 * can initiate host connections or read sensitive campaign data.
 *
 * @param userId - The ID of the connecting user
 * @param campaign - The campaign record from the database
 * @returns boolean true if authorized
 */
export function authorizeCampaignHost(userId: string, campaign: CampaignRecord): boolean {
  return campaign.dmId === userId;
}
