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
  it('projects martial resources and actual Hit Dice without requiring a spell profile', () => {
    const { profiles, pools } = projectCharacterCasting(
      {
        classSlug: 'fighter',
        edition: '2024',
        level: 4,
        abilities: { CON: { modifier: 2 } },
        hitDice: { current: 2, max: 4, dieType: 10 },
        resources: [
          {
            id: 'second-wind',
            name: 'Second Wind',
            description: 'Healing',
            maxUses: 3,
            currentUses: 1,
            rechargeType: 'long-rest',
            recovery: { shortRest: 1, longRest: 'full' },
          },
        ],
      },
      [],
    );
    expect(profiles).toEqual([]);
    expect(pools['feature:second-wind']).toMatchObject({
      current: 1,
      max: 3,
      classResourceId: 'second-wind',
      recovery: { shortRest: 1, longRest: 'full' },
    });
    expect(pools['feature:hit-dice']).toMatchObject({
      current: 2,
      max: 4,
      hitDieSize: 10,
      hitDieModifier: 2,
      recovery: { longRest: 'full' },
    });
  });

  it('preserves unknown expenditure and manual resets, and excludes retired counters', () => {
    const { pools } = projectCharacterCasting(
      {
        resources: [
          {
            id: 'daily',
            name: 'Daily',
            description: '',
            maxUses: 1,
            rechargeType: 'daily',
          },
          {
            id: 'retired',
            name: 'Retired',
            description: '',
            maxUses: 1,
            currentUses: 1,
            rechargeType: 'long-rest',
            active: false,
          },
        ],
      },
      [],
    );
    expect(pools['feature:daily'].current).toBeUndefined();
    expect(pools['feature:daily'].resetOn).toBe('manual');
    expect(pools['feature:retired']).toBeUndefined();
  });

  it('rejects duplicate resource IDs or impossible balances instead of manufacturing uses', () => {
    const tracker = {
      id: 'rage',
      name: 'Rage',
      description: '',
      maxUses: 2,
      currentUses: 3,
      rechargeType: 'long-rest',
    };
    expect(() =>
      projectCharacterCasting({ resources: [tracker] }, []),
    ).toThrow();
    tracker.currentUses = 1;
    expect(() =>
      projectCharacterCasting({ resources: [tracker, tracker] }, []),
    ).toThrow();
  });
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
