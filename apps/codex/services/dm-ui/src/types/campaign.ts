import { z } from 'zod';

// Zod schema for campaign creation/update
export const campaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(100, 'Name too long'),
  description: z.string().optional(),
  gameSystem: z.string().min(1, 'Game system is required'),
  currentDate: z.string().optional(),
  settings: z.record(z.any()).optional().default({}),
  status: z.enum(['planning', 'active', 'completed', 'archived']).default('planning')
});

export type CampaignFormData = z.infer<typeof campaignSchema>;

// Game system options
export const GAME_SYSTEMS = [
  { value: 'dnd5e', label: 'D&D 5th Edition' },
  { value: 'pathfinder2e', label: 'Pathfinder 2e' },
  { value: 'pf1e', label: 'Pathfinder 1e' },
  { value: 'dnd35', label: 'D&D 3.5e' },
  { value: 'callofcthulhu', label: 'Call of Cthulhu' },
  { value: 'shadowrun', label: 'Shadowrun' },
  { value: 'starfinder', label: 'Starfinder' },
  { value: 'savage-worlds', label: 'Savage Worlds' },
  { value: 'fate', label: 'Fate Core' },
  { value: 'other', label: 'Other' }
] as const;

// Campaign status options
export const CAMPAIGN_STATUSES = [
  { value: 'planning', label: 'Planning', description: 'Campaign in planning phase' },
  { value: 'active', label: 'Active', description: 'Currently running campaign' },
  { value: 'completed', label: 'Completed', description: 'Campaign has concluded' },
  { value: 'archived', label: 'Archived', description: 'Archived for reference' }
] as const;
