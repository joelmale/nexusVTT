import { describe, expect, it } from 'vitest';

import type {
  CampaignItem,
  CampaignNpc,
  CampaignSecret,
} from '@/demo/fixture-registry';

import {
  filterPlayerViewHeldItems,
  filterPlayerViewItem,
  filterPlayerViewNpc,
  filterPlayerViewSecret,
  isItemVisibleToPlayers,
  stripDmAnnotations,
} from './playerViewModel';

describe('playerViewModel', () => {
  describe('filterPlayerViewItem', () => {
    it('returns concealed status for undiscovered item', () => {
      const item: CampaignItem = {
        id: 'item-1',
        name: 'Staff of Power',
        playerName: 'Gnarled Wooden Rod',
        itemType: 'staff',
        rarity: 'very-rare',
        requiresAttunement: true,
        quantity: 1,
        description: 'A mighty staff crackling with arcane force.',
        mechanics: '+2 to spell attack rolls and AC.',
        holder: { kind: 'none' },
        questIds: [],
        discovered: false,
        identified: false,
      };

      const res = filterPlayerViewItem(item);
      expect(res.visibility).toBe('concealed');
      expect(res.name).toBe('Undiscovered Item');
      expect(res.isMagicRevealed).toBe(false);
      expect(res.canViewStats).toBe(false);
      expect(res.description).toContain('not yet been discovered');
    });

    it('returns unidentified status with player-facing name when discovered but not identified', () => {
      const item: CampaignItem = {
        id: 'item-2',
        name: 'Potion of Invisibility',
        playerName: 'Smoky Glass Vial',
        itemType: 'potion',
        rarity: 'very-rare',
        requiresAttunement: false,
        quantity: 1,
        description: 'A vial containing shimmering grey fluid.',
        mechanics: 'Drink to become invisible for 1 hour.',
        holder: { kind: 'none' },
        questIds: [],
        discovered: true,
        identified: false,
      };

      const res = filterPlayerViewItem(item);
      expect(res.visibility).toBe('unidentified');
      expect(res.name).toBe('Smoky Glass Vial');
      expect(res.rarityDisplay).toBe('Unknown Rarity');
      expect(res.isMagicRevealed).toBe(false);
      expect(res.canViewStats).toBe(true);
      expect(res.mechanics).toContain('Requires an Identify spell');
    });

    it('falls back to "Unidentified Item" when playerName is not set', () => {
      const item: CampaignItem = {
        id: 'item-2b',
        name: 'Sun Blade',
        itemType: 'weapon',
        rarity: 'rare',
        requiresAttunement: true,
        quantity: 1,
        description: 'A hilt without a blade.',
        holder: { kind: 'none' },
        questIds: [],
        discovered: true,
        identified: false,
      };

      const res = filterPlayerViewItem(item);
      expect(res.name).toBe('Unidentified Item');
      expect(res.visibility).toBe('unidentified');
    });

    it('returns full revealed item when discovered and identified', () => {
      const item: CampaignItem = {
        id: 'item-3',
        name: 'Cloak of Elvenkind',
        playerName: 'Grey Traveler Cloak',
        itemType: 'wondrous-item',
        rarity: 'uncommon',
        requiresAttunement: true,
        quantity: 1,
        description: 'Spun from elven silk.',
        mechanics: 'Advantage on Stealth checks.',
        holder: { kind: 'none' },
        questIds: [],
        discovered: true,
        identified: true,
      };

      const res = filterPlayerViewItem(item);
      expect(res.visibility).toBe('revealed');
      expect(res.name).toBe('Cloak of Elvenkind');
      expect(res.rarityDisplay).toBe('uncommon');
      expect(res.mechanics).toBe('Advantage on Stealth checks.');
      expect(res.isMagicRevealed).toBe(true);
      expect(res.canViewStats).toBe(true);
    });
  });

  describe('filterPlayerViewNpc', () => {
    it('strips combat summary and DM tags for player view', () => {
      const npc: CampaignNpc = {
        id: 'npc-1',
        name: 'Captain Valen',
        role: 'Town Guard Captain',
        ancestry: 'Human',
        motivation: 'Protect the gatehouse from smugglers',
        relationship: 'Cautiously cooperative with party',
        tags: ['friendly', 'dm:traitor', 'guard'],
        factionIds: [],
        combatSummary: {
          hp: 45,
          maxHp: 45,
          ac: 16,
          cr: '3',
        },
        statBlockRef: {
          slug: 'veteran',
          ruleset: '2014',
        },
      };

      const res = filterPlayerViewNpc(npc);
      expect(res.name).toBe('Captain Valen');
      expect(res.role).toBe('Town Guard Captain');
      expect(res.ancestry).toBe('Human');
      expect(res.tags).toEqual(['friendly', 'guard']);
      expect(res.hasCombatStats).toBe(false);
      // @ts-expect-error verifying stripped combatSummary
      expect(res.combatSummary).toBeUndefined();
      // @ts-expect-error verifying stripped statBlockRef
      expect(res.statBlockRef).toBeUndefined();
    });
  });

  describe('filterPlayerViewSecret', () => {
    it('returns secret when revealed', () => {
      const secret: CampaignSecret = {
        id: 'sec-1',
        title: 'Traitor in the Council',
        content: 'Lord Belmont takes bribes.',
        revealed: true,
        revealedInSessionId: 'sess-1',
        attachments: [],
      };

      expect(filterPlayerViewSecret(secret)).toBe(secret);
    });

    it('returns null when secret is unrevealed', () => {
      const secret: CampaignSecret = {
        id: 'sec-2',
        title: 'Hidden Catacombs',
        content: 'Under the wine cellar.',
        revealed: false,
        attachments: [],
      };

      expect(filterPlayerViewSecret(secret)).toBeNull();
    });
  });

  describe('stripDmAnnotations', () => {
    it('removes [DM]...[/DM] blocks and DM Notes lines', () => {
      const text = `
The ancient temple stands silent.
[DM]There is a pit trap at the threshold (DC 15 Perception).[/DM]
Water drips from the ceiling.
DM Notes: The cultists attack if alerted.
Secret: The altar opens with blood.
A golden statue rests on the pedestal.
`;

      const stripped = stripDmAnnotations(text);
      expect(stripped).toContain('The ancient temple stands silent.');
      expect(stripped).toContain('Water drips from the ceiling.');
      expect(stripped).toContain('A golden statue rests on the pedestal.');
      expect(stripped).not.toContain('pit trap');
      expect(stripped).not.toContain('cultists attack');
      expect(stripped).not.toContain('altar opens');
    });

    it('handles empty or blank text gracefully', () => {
      expect(stripDmAnnotations('')).toBe('');
    });
  });

  describe('held items filtering', () => {
    it('filters out undiscovered items', () => {
      const items: CampaignItem[] = [
        {
          id: 'i1',
          name: 'Potion of Healing',
          itemType: 'potion',
          rarity: 'common',
          requiresAttunement: false,
          quantity: 2,
          description: '',
          holder: { kind: 'none' },
          questIds: [],
          discovered: true,
          identified: true,
        },
        {
          id: 'i2',
          name: 'Vorpal Sword',
          itemType: 'weapon',
          rarity: 'legendary',
          requiresAttunement: true,
          quantity: 1,
          description: '',
          holder: { kind: 'none' },
          questIds: [],
          discovered: false,
          identified: false,
        },
      ];

      expect(isItemVisibleToPlayers(items[0]!)).toBe(true);
      expect(isItemVisibleToPlayers(items[1]!)).toBe(false);

      const visible = filterPlayerViewHeldItems(items);
      expect(visible).toHaveLength(1);
      expect(visible[0]?.id).toBe('i1');
    });
  });
});
