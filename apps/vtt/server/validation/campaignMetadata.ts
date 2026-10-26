import type { CampaignMetadata } from '../repositories/base.js';

const EDITIONS = new Set(['2014', '2024']);
const MODES = new Set(['campaign', 'one-shot']);
const MOODS = new Set([
  'parchment',
  'grimdark',
  'feywild',
  'arcane-night',
  'dark-mode',
]);

/** Only present values are returned, so updates cannot reset omitted fields. */
export function readCampaignMetadata(
  input: unknown,
): { metadata: CampaignMetadata } | { error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'Campaign input must be an object.' };
  }
  const record = input as Record<string, unknown>;
  const metadata: CampaignMetadata = {};
  if (record.edition !== undefined) {
    if (typeof record.edition !== 'string' || !EDITIONS.has(record.edition)) {
      return { error: 'Edition must be 2014 or 2024.' };
    }
    metadata.edition = record.edition as CampaignMetadata['edition'];
  }
  if (record.mode !== undefined) {
    if (typeof record.mode !== 'string' || !MODES.has(record.mode)) {
      return { error: 'Mode must be campaign or one-shot.' };
    }
    metadata.mode = record.mode as CampaignMetadata['mode'];
  }
  if (record.mood !== undefined) {
    if (
      record.mood !== null &&
      (typeof record.mood !== 'string' || !MOODS.has(record.mood))
    ) {
      return { error: 'Mood must be a supported campaign mood or null.' };
    }
    metadata.mood = record.mood as CampaignMetadata['mood'];
  }
  return { metadata };
}
