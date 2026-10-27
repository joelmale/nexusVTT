import { describe, expect, it } from 'vitest';
import { REFERENCE_BUILDS } from '../tests/fixtures/referenceBuilds';
import { resolveCastingGrants, castingGrantErrors } from './castingSources';

describe('class free-casting grants share resource identities', () => {
  it('binds each Mystic Arcanum rank to its own counter and validates the chosen level', () => {
    const data = { ...REFERENCE_BUILDS.WL24.creationData, level: 17 };
    const grants = resolveCastingGrants(data).filter(
      (grant) => grant.source.resourceId,
    );
    expect(
      grants.map((grant) => [grant.source.resourceId, grant.spellLevel]),
    ).toEqual([
      ['mystic-arcanum-6', 6],
      ['mystic-arcanum-7', 7],
      ['mystic-arcanum-8', 8],
      ['mystic-arcanum-9', 9],
    ]);
    expect(
      grants.every(
        (grant) => grant.spellChoices === 1 && !grant.source.allowClassSlots,
      ),
    ).toBe(true);
    expect(castingGrantErrors(data)).toEqual(
      expect.arrayContaining(
        [6, 7, 8, 9].map(
          (level) =>
            `Choose 1 different level ${level} spells for mystic-arcanum-${level}.`,
        ),
      ),
    );
  });
  it('requires distinct third-level Wizard signature spells already in the book', () => {
    const data = {
      ...REFERENCE_BUILDS.W24.creationData,
      level: 20,
      spellSelection: {
        ...REFERENCE_BUILDS.W24.creationData.spellSelection,
        spellbook: ['fireball', 'fly'],
      },
    };
    const sources = resolveCastingGrants(data)
      .filter((grant) => grant.source.resourceId)
      .map((grant, index) => ({
        ...grant.source,
        preparedSpells: [index === 0 ? 'fireball' : 'fly'],
      }));
    expect(
      castingGrantErrors({ ...data, additionalCastingSources: sources }),
    ).toEqual([]);
    expect(
      castingGrantErrors({
        ...data,
        additionalCastingSources: sources.map((source) => ({
          ...source,
          preparedSpells: ['fireball'],
        })),
      }),
    ).toContain('Choose two different Signature Spells from your spellbook.');
    expect(
      castingGrantErrors({
        ...data,
        additionalCastingSources: sources.map((source) => ({
          ...source,
          preparedSpells: ['lightning-bolt'],
        })),
      }),
    ).toContain('Choose Signature Spells from your spellbook.');
  });
  it('adds revised Paladin and Ranger fixed free castings at their actual levels', () => {
    const base = REFERENCE_BUILDS.F24.creationData;
    expect(
      resolveCastingGrants({ ...base, classSlug: 'paladin', level: 1 }).filter(
        (grant) => grant.source.resourceId,
      ),
    ).toEqual([]);
    expect(
      resolveCastingGrants({ ...base, classSlug: 'paladin', level: 5 })
        .filter((grant) => grant.source.resourceId)
        .map((grant) => grant.source),
    ).toMatchObject([
      { resourceId: 'paladins-smite', preparedSpells: ['divine-smite'] },
      { resourceId: 'faithful-steed', preparedSpells: ['find-steed'] },
    ]);
    expect(
      resolveCastingGrants({ ...base, classSlug: 'ranger', level: 17 }).find(
        (grant) => grant.source.resourceId === 'favored-enemy',
      )?.source,
    ).toMatchObject({ freeUses: 6, preparedSpells: ["hunter's-mark"] });
  });
});
