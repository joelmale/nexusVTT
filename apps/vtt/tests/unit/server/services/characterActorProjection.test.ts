import { describe, expect, it } from 'vitest';
import {
  spellDefinitionSchema,
  spellcastingProfileSchema,
} from '@nexus/game-contracts';
import {
  bundledSpellDefinitions,
  projectCharacterCasting,
} from '../../../../server/services/characterActorProjection.js';

const campaignId = '11111111-1111-4111-8111-111111111111';
const ownerId = '22222222-2222-4222-8222-222222222222';

describe('saved character casting projection', () => {
  it('projects at-will class grants as usable independent pools without class slot costs', () => {
    const definitions = bundledSpellDefinitions(campaignId, ownerId, '2024');
    const { profiles, pools } = projectCharacterCasting(
      {
        abilities: { CHA: { modifier: 3 } },
        proficiencyBonus: 2,
        castingSources: [
          {
            id: 'invocation',
            sourceType: 'class',
            sourceSlug: 'armor-of-shadows',
            ability: 'CHA',
            preparedSpells: ['mage-armor'],
            atWill: true,
          },
        ],
      },
      definitions,
    );
    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({
      sourceType: 'class',
      knownSpellSlugs: ['mage-armor'],
      spellSaveDC: 13,
    });
    expect(pools[profiles[0].resourcePoolId].poolType).toBe('at-will');
  });
  it.each(['2014', '2024'] as const)(
    'loads complete canonical %s spell definitions',
    (edition) => {
      const spells = bundledSpellDefinitions(campaignId, ownerId, edition);
      expect(spells.length).toBeGreaterThan(300);
      expect(
        spells.find((spell) => spell.slug === 'magic-missile')?.level,
      ).toBe(1);
      expect(
        spells.every((spell) => spellDefinitionSchema.safeParse(spell).success),
      ).toBe(true);
      expect(spells.every((spell) => spell.ruleset.edition === edition)).toBe(
        true,
      );
    },
  );

  it('preserves used slots, zero attack bonus, book and preparations without making cantrips into slots', () => {
    const spells = bundledSpellDefinitions(campaignId, ownerId, '2024');
    const { profiles, pools } = projectCharacterCasting(
      {
        classSlug: 'wizard',
        edition: '2024',
        level: 1,
        abilities: { INT: { modifier: -2 } },
        proficiencyBonus: 2,
        spellcasting: {
          ability: 'INT',
          spellAttackBonus: 0,
          spellSaveDC: 8,
          spellSlots: [3, 2, 0],
          usedSpellSlots: [0, 1, 0],
          cantripsKnown: ['fire-bolt'],
          spellbook: ['magic-missile', 'shield'],
          preparedSpells: ['shield'],
        },
      },
      spells,
    );
    expect(pools['class:wizard:slots'].slots).toEqual({
      '1': { total: 2, current: 1 },
    });
    expect(profiles[0]).toMatchObject({
      spellAttackBonus: 0,
      preparationLimit: 4,
      knownSpellSlugs: ['fire-bolt', 'magic-missile', 'shield'],
      preparedSpellSlugs: ['shield'],
    });
    expect(spellcastingProfileSchema.safeParse(profiles[0]).success).toBe(true);
  });

  it('keeps martial character feat grants in their own casting source and daily-use pool', () => {
    const { profiles, pools } = projectCharacterCasting(
      {
        classSlug: 'fighter',
        proficiencyBonus: 2,
        abilities: { WIS: { modifier: 1 } },
        castingSources: [
          {
            id: 'feat:magic-initiate',
            sourceType: 'feat',
            sourceSlug: 'magic-initiate',
            ability: 'WIS',
            cantrips: ['guidance'],
            knownSpells: ['healing-word'],
            preparedSpells: ['healing-word'],
            freeUses: 1,
            allowClassSlots: true,
          },
        ],
      },
      bundledSpellDefinitions(campaignId, ownerId, '2024'),
    );
    expect(profiles).toHaveLength(2);
    expect(
      profiles.every(
        (profile) =>
          profile.sourceType === 'feat' && profile.spellSaveDC === 11,
      ),
    ).toBe(true);
    expect(
      Object.values(pools).every(
        (pool) => pool.poolType === 'uses' && pool.current === 1,
      ),
    ).toBe(true);
  });
});
