import type {
  CampaignLifecycle,
  CampaignSession,
  PlayerCharacter,
} from '../ashes-of-veyra/types';
import type { CampaignSummary } from '../../services/campaign-api';

export type { CampaignLifecycle };

export type CampaignTier = 'tier-1' | 'tier-2' | 'tier-3' | 'tier-4';

export interface CampaignCatalogEntry {
  slug: string;
  campaign: CampaignSummary;
  subtitle: string;
  premise: string;
  ruleset: 'D&D 5e';
  edition: '2014' | '2024' | '2014/2024 compatible';
  lifecycle: CampaignLifecycle;
  tier: CampaignTier;
  tags: string[];
  playerCharacters: PlayerCharacter[];
  selectedSessionId: string;
  showcaseSessions: CampaignSession[];
  fixtureSource: 'catalog' | 'full-demo';
}

export type CatalogIntegrityReason =
  | 'duplicate-id'
  | 'invalid-date'
  | 'invalid-session-count'
  | 'missing-selected-session'
  | 'campaign-mismatch'
  | 'duplicate-session-number'
  | 'missing-plan'
  | 'invalid-step-order'
  | 'invalid-estimate';

export interface CatalogIntegrityIssue {
  path: string;
  reference: string;
  reason: CatalogIntegrityReason;
}
