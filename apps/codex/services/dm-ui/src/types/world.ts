import { z } from 'zod';

export const worldSchema = z.object({
  name: z.string().min(1, 'World name is required').max(200, 'Name too long'),
  description: z.string().optional(),
  type: z.enum([
    'continent',
    'region',
    'kingdom',
    'city',
    'town',
    'village',
    'location',
    'dungeon',
    'plane',
    'other',
  ]),
  parentWorldId: z.string().optional(),
  geography: z.string().optional(),
  climate: z.string().optional(),
  population: z.number().int().min(0).optional(),
  government: z.string().optional(),
  factions: z.array(z.string()).optional(),
  points_of_interest: z.array(z.string()).optional(),
  map_url: z.string().url().optional().or(z.literal('')),
  notes: z.string().optional(),
});

export type WorldFormData = z.infer<typeof worldSchema>;

// Re-export World type from db schema for convenience
export type { World } from '@/db/schema';

export const WORLD_TYPES = [
  { value: 'continent', label: 'Continent', icon: '🌍' },
  { value: 'region', label: 'Region', icon: '🗺️' },
  { value: 'kingdom', label: 'Kingdom', icon: '👑' },
  { value: 'city', label: 'City', icon: '🏙️' },
  { value: 'town', label: 'Town', icon: '🏘️' },
  { value: 'village', label: 'Village', icon: '🏡' },
  { value: 'location', label: 'Location', icon: '📍' },
  { value: 'dungeon', label: 'Dungeon', icon: '⚔️' },
  { value: 'plane', label: 'Plane', icon: '✨' },
  { value: 'other', label: 'Other', icon: '❓' },
] as const;

export const CLIMATE_OPTIONS = [
  'Tropical',
  'Arid',
  'Temperate',
  'Cold',
  'Polar',
  'Mediterranean',
  'Coastal',
  'Mountain',
  'Volcanic',
  'Magical',
] as const;
