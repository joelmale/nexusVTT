import { describe, expect, it } from 'vitest';
import { getRecommendation } from './recommendationService';
import { draftToCreationData, creationDataToDraft } from '../adapters/draftAdapter';
import { castingGrantErrors, resolveCastingGrants } from './castingSources';
import { calculateCharacterStats } from '../utils/characterCreationUtils';
import { toNexusCharacter, createdCharacterToNexus } from '../adapters/nexusCharacter';
import { REFERENCE_BUILDS } from '../tests/fixtures/referenceBuilds';
import type { CharacterCreationData } from '../types/dnd';
import { classGrantErrors } from './classGrantChoices';

describe('independent casting grants (SRD 5.2.1 pp84–87)', () => {
  it('keeps repeated Lessons Magic Initiate lists, casting abilities and free uses independent through saving', () => {
    const data: CharacterCreationData = {
      ...REFERENCE_BUILDS.WL24.creationData,
      level: 2,
      humanOriginFeat: 'alert',
      eldritchInvocations: ['eldritch-mind', 'lessons-of-the-first-ones'],
      featChoices: {
        'invocation:lessons-of-the-first-ones': {
          targets: ['magic-initiate-cleric', 'magic-initiate-wizard'],
        },
      },
    };
    data.additionalCastingSources = resolveCastingGrants(data).map((grant) => ({
      ...grant.source,
      ability: grant.spellClass === 'cleric' ? 'WIS' : 'INT',
    }));
    expect(classGrantErrors(data)).toEqual([]);
    expect(castingGrantErrors(data)).toEqual([]);
    const restored = draftToCreationData(creationDataToDraft(data));
    const saved = JSON.parse(
      JSON.stringify(
        createdCharacterToNexus(calculateCharacterStats(restored)),
      ),
    );
    expect(saved.castingSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'feat:magic-initiate:cleric',
          ability: 'WIS',
          freeUses: 1,
          allowClassSlots: true,
        }),
        expect.objectContaining({
          id: 'feat:magic-initiate:wizard',
          ability: 'INT',
          freeUses: 1,
          allowClassSlots: true,
        }),
      ]),
    );
    expect(
      new Set(saved.castingSources.map((source: { id: string }) => source.id))
        .size,
    ).toBe(2);
    expect(saved.spellcasting.preparedSpells).toEqual(
      data.spellSelection.preparedSpells,
    );
    const changed = {
      ...restored,
      featChoices: {
        'invocation:lessons-of-the-first-ones': {
          targets: ['magic-initiate-cleric'],
        },
      },
    };
    expect(castingGrantErrors(changed).join()).toContain('requires review');
    expect(
      classGrantErrors({
        ...data,
        featChoices: {
          'invocation:lessons-of-the-first-ones': {
            targets: ['magic-initiate-cleric', 'magic-initiate-cleric'],
          },
        },
      }).join(),
    ).toContain('different eligible targets');
  });
  it('keeps invocation at-will spells and Tome rituals separate from Pact Magic', () => {
    const data = draftToCreationData(
      getRecommendation({ classSlug: 'warlock', edition: '2024' }).draft,
    );
    const armor = resolveCastingGrants({
      ...data,
      eldritchInvocations: ['armor-of-shadows'],
    }).find((grant) => grant.source.sourceSlug === 'armor-of-shadows');
    expect(armor?.source).toMatchObject({
      preparedSpells: ['mage-armor'],
      atWill: true,
      ability: 'CHA',
    });
    const tome = resolveCastingGrants({
      ...data,
      eldritchInvocations: ['pact-of-the-tome'],
    }).find((grant) => grant.source.sourceSlug === 'pact-of-the-tome');
    expect(tome?.source.cantrips).toHaveLength(3);
    expect(tome?.source.preparedSpells).toHaveLength(2);
    expect(tome?.source).toMatchObject({ atWill: true, ritualOnly: true });
    expect(
      castingGrantErrors({
        ...data,
        eldritchInvocations: ['pact-of-the-tome'],
      }),
    ).toEqual([]);
  });
  it('grants Magic Initiate to a martial Acolyte without adding class spellcasting', () => {
    const data = {
      ...draftToCreationData(
        getRecommendation({ classSlug: 'fighter', edition: '2024' }).draft,
      ),
      background: 'acolyte-2024',
    };
    const character = calculateCharacterStats(data);
    expect(character.spellcasting).toBeUndefined();
    const source = character.castingSources?.find(
      (entry) => entry.sourceType === 'feat',
    );
    expect(source).toMatchObject({
      sourceSlug: 'magic-initiate-cleric',
      freeUses: 1,
      allowClassSlots: true,
    });
    expect(source?.cantrips).toHaveLength(2);
    expect(source?.preparedSpells).toHaveLength(1);
    expect(toNexusCharacter(character).castingSources).toEqual(
      character.castingSources,
    );
  });

  it('keeps a feat Shield separate from the Wizard spellbook and preparation limit', () => {
    const data = draftToCreationData(
      getRecommendation({ classSlug: 'wizard', edition: '2024' }).draft,
    );
    const character = calculateCharacterStats(data);
    expect(character.spellcasting?.spellbook).toHaveLength(6);
    expect(character.spellcasting?.preparedSpells).toHaveLength(4);
    expect(
      character.castingSources?.find((source) => source.sourceType === 'feat')
        ?.preparedSpells,
    ).toEqual(['shield']);
  });

  it.each([
    [1, []],
    [3, ['longstrider']],
    [5, ['longstrider', 'pass-without-trace']],
  ] as const)('gates Wood Elf spells at level %i', (level, expected) => {
    const data = {
      ...draftToCreationData(
        getRecommendation({
          classSlug: 'rogue',
          speciesSlug: 'elf-2024',
          edition: '2024',
        }).draft,
      ),
      selectedLineage: 'wood-elf',
      level,
    };
    const source = resolveCastingGrants(data).find(
      (grant) => grant.source.sourceType === 'species',
    )?.source;
    expect(source?.cantrips).toEqual(['druidcraft']);
    expect(source?.preparedSpells).toEqual(expected);
  });

  it('rejects wrong-list, duplicate and stale source choices', () => {
    const data = draftToCreationData(
      getRecommendation({ classSlug: 'wizard', edition: '2024' }).draft,
    );
    const source = resolveCastingGrants(data).find(
      (grant) => grant.source.sourceType === 'feat',
    )!.source;
    data.additionalCastingSources = [
      {
        ...source,
        cantrips: ['guidance', 'guidance'],
        preparedSpells: ['healing-word'],
      },
    ];
    expect(castingGrantErrors(data).length).toBeGreaterThan(1);
    data.background = 'soldier-2024';
    expect(castingGrantErrors(data).join()).toContain('requires review');
  });
});
