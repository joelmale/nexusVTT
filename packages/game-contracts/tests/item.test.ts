import { describe, it, expect } from 'vitest';
import { itemDefinitionSchema, itemInstanceSchema } from '../src';

describe('Item & ItemInstance Schemas', () => {
  it('validates item definition and physical item instance with charges', () => {
    const wandDef = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      schemaVersion: 1,
      revision: 1,
      ownerId: 'system',
      name: 'Wand of Magic Missiles',
      kind: 'item' as const,
      ruleset: {
        system: 'dnd5e' as const,
        edition: '2024' as const,
        contentPackId: 'srd-5.2.1',
        contentRevision: '1.0',
        rulesRevision: '1.0',
      },
      itemType: 'wondrous_item' as const,
      rarity: 'uncommon' as const,
      requiresAttunement: false,
      weightLb: 1,
      costGp: 500,
      description: 'This wand has 7 charges.',
      maxCharges: 7,
      rechargeRule: '1d6 + 1 charges at dawn',
      tags: ['wand', 'magic'],
      createdAt: '2026-09-24T00:00:00Z',
      updatedAt: '2026-09-24T00:00:00Z',
    };
    expect(itemDefinitionSchema.parse(wandDef).maxCharges).toBe(7);

    const wandInstance = {
      instanceId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      itemRef: {
        kind: 'item' as const,
        id: wandDef.id,
        revision: 1,
      },
      name: 'Wand of Magic Missiles',
      quantity: 1,
      isEquipped: true,
      isAttuned: false,
      currentCharges: 5,
    };
    const parsedInstance = itemInstanceSchema.parse(wandInstance);
    expect(parsedInstance.currentCharges).toBe(5);
  });

  it('validates physical spellbook item with transcription queue', () => {
    const spellbookItem = {
      instanceId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      itemRef: {
        kind: 'item' as const,
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        revision: 1,
      },
      name: 'Wizard Grimoire',
      quantity: 1,
      isEquipped: true,
      isAttuned: false,
      bookContent: {
        transcriptionQueue: [
          {
            spellSlug: 'identify',
            costGp: 50,
            timeHoursTotal: 2,
            timeHoursSpent: 1,
            isComplete: false,
          },
        ],
        annotations: {
          fireball: 'Handwritten margins contain notes on elemental focus.',
        },
      },
    };
    const parsed = itemInstanceSchema.parse(spellbookItem);
    expect(parsed.bookContent?.transcriptionQueue[0].spellSlug).toBe('identify');
  });
});
