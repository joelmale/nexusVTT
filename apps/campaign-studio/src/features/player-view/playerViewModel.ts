import type {
  CampaignItem,
  CampaignNpc,
  CampaignSecret,
} from '@/demo/fixture-registry';

export interface PlayerViewItemResult {
  /** 'concealed' if undiscovered, 'unidentified' if discovered but not identified, 'revealed' if identified. */
  visibility: 'concealed' | 'unidentified' | 'revealed';
  name: string;
  subtitle: string;
  rarityDisplay: string;
  description: string;
  mechanics?: string;
  isMagicRevealed: boolean;
  canViewStats: boolean;
}

/**
 * Filter an item for Player View.
 * - Undiscovered: concealed from players.
 * - Discovered but unidentified: shows player-facing name, hides mechanics & true rarity.
 * - Discovered & identified: shows true name and full mechanics.
 */
export function filterPlayerViewItem(
  item: CampaignItem,
): PlayerViewItemResult {
  if (!item.discovered) {
    return {
      visibility: 'concealed',
      name: 'Undiscovered Item',
      subtitle: 'Concealed item',
      rarityDisplay: 'Unknown',
      description: 'This item has not yet been discovered by the adventuring party.',
      isMagicRevealed: false,
      canViewStats: false,
    };
  }

  if (!item.identified) {
    const displayName = item.playerName?.trim() || 'Unidentified Item';
    return {
      visibility: 'unidentified',
      name: displayName,
      subtitle: `${item.itemType} · Unidentified`,
      rarityDisplay: 'Unknown Rarity',
      description:
        item.description ||
        'A peculiar item whose origins and true nature remain a mystery.',
      mechanics:
        'Magical properties remain latent and unknown. Requires an Identify spell or examination during a short rest.',
      isMagicRevealed: false,
      canViewStats: true,
    };
  }

  return {
    visibility: 'revealed',
    name: item.name,
    subtitle: `${item.itemType} · ${item.rarity}`,
    rarityDisplay: item.rarity,
    description: item.description,
    mechanics: item.mechanics,
    isMagicRevealed: true,
    canViewStats: true,
  };
}

export interface PlayerViewNpcResult {
  name: string;
  role?: string;
  ancestry?: string;
  motivation?: string;
  relationship?: string;
  tags: string[];
  /** Combat summary (AC, HP, CR) is strictly hidden in player view. */
  hasCombatStats: false;
}

/**
 * Filter an NPC for Player View.
 * Strips DM-only combat statistics, stat block refs, and secret notes.
 */
export function filterPlayerViewNpc(npc: CampaignNpc): PlayerViewNpcResult {
  return {
    name: npc.name,
    role: npc.role,
    ancestry: npc.ancestry,
    motivation: npc.motivation,
    relationship: npc.relationship,
    tags: npc.tags.filter((tag) => !tag.toLowerCase().startsWith('dm:')),
    hasCombatStats: false,
  };
}

/**
 * Filter a secret for Player View.
 * Returns null if the secret is unrevealed.
 */
export function filterPlayerViewSecret(
  secret: CampaignSecret,
): CampaignSecret | null {
  return secret.revealed ? secret : null;
}

/**
 * Strip DM-only annotations or tags from arbitrary text.
 * Handles `[DM]...[/DM]`, `<!-- DM ... -->`, or paragraphs starting with "DM Notes:".
 */
export function stripDmAnnotations(text: string): string {
  if (!text) return '';
  return text
    .replace(/\[DM\][\s\S]*?\[\/DM\]/gi, '')
    .replace(/<!--\s*DM[\s\S]*?-->/gi, '')
    .split('\n')
    .filter((line) => !/^\s*(DM\s*Notes?|Secret):/i.test(line))
    .join('\n')
    .trim();
}

/**
 * Checks whether an item held by a creature or location is visible to players.
 */
export function isItemVisibleToPlayers(item: CampaignItem): boolean {
  return Boolean(item.discovered);
}

/**
 * Filter a list of items held by an entity for Player View.
 */
export function filterPlayerViewHeldItems(
  items: CampaignItem[],
): CampaignItem[] {
  return items.filter(isItemVisibleToPlayers);
}
