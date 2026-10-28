import { describe, expect, it } from 'vitest';
import { resolveCantripAction } from './cantripActions';
import { deriveClassMechanics } from './classMechanics';

const base = {
  edition: '2024' as const,
  spellAttackBonus: 5,
  spellSaveDC: 13,
};

describe('cantrip actions', () => {
  it.each([
    [1, '1d10'],
    [4, '1d10'],
    [5, '2d10'],
    [10, '2d10'],
    [11, '3d10'],
    [16, '3d10'],
    [17, '4d10'],
    [20, '4d10'],
  ])('Fire Bolt at character level %i rolls %s', (characterLevel, dice) => {
    const action = resolveCantripAction({
      ...base,
      slug: 'fire-bolt',
      characterLevel,
    });
    expect(action).toMatchObject({
      kind: 'attack',
      attackBonus: 5,
      dice,
      damageType: 'fire',
      attacks: 1,
    });
  });

  it.each([
    [4, 1],
    [5, 2],
    [10, 2],
    [11, 3],
    [16, 3],
    [17, 4],
  ])(
    'Eldritch Blast at level %i makes %i beams of 1d10 (dice do not scale)',
    (characterLevel, beams) => {
      const action = resolveCantripAction({
        ...base,
        slug: 'eldritch-blast',
        characterLevel,
      });
      expect(action).toMatchObject({
        kind: 'attack',
        dice: '1d10',
        damageType: 'force',
        attacks: beams,
        rangeFeet: 120,
      });
    },
  );

  it('a save cantrip reports the save and DC instead of an attack bonus', () => {
    const action = resolveCantripAction({
      ...base,
      slug: 'sacred-flame',
      characterLevel: 5,
    })!;
    expect(action).toMatchObject({
      kind: 'save',
      saveAbility: 'DEX',
      saveDC: 13,
      dice: '2d8',
      damageType: 'radiant',
    });
    expect(action.attackBonus).toBeUndefined();
  });

  it('a utility cantrip has no damage', () => {
    const action = resolveCantripAction({
      ...base,
      slug: 'light',
      characterLevel: 1,
    })!;
    expect(action.kind).not.toBe('attack');
    expect(action.dice).toBeUndefined();
    expect(action.damageNotation).toBeUndefined();
  });

  it('ignores unknown spells and spells that are not cantrips', () => {
    expect(
      resolveCantripAction({ ...base, slug: 'nonsense', characterLevel: 1 }),
    ).toBeUndefined();
    expect(
      resolveCantripAction({
        ...base,
        slug: 'magic-missile',
        characterLevel: 1,
      }),
    ).toBeUndefined();
  });

  it('applies the 2014 Eldritch Blast beams and invocation effects', () => {
    const action = resolveCantripAction({
      edition: '2014',
      characterLevel: 5,
      slug: 'eldritch-blast',
      spellAttackBonus: 5,
      spellSaveDC: 13,
      cantripEffects: {
        'eldritch-blast': { damageBonus: 3, pushFeet: 10, requiresHit: true },
      },
    })!;
    expect(action).toMatchObject({
      attacks: 2,
      dice: '1d10',
      damageNotation: '1d10+3',
      pushFeet: 10,
      requiresHit: true,
    });
  });

  describe('with saved 2024 invocation effects', () => {
    const abilities = {
      STR: { score: 8, modifier: -1 },
      DEX: { score: 14, modifier: 2 },
      CON: { score: 14, modifier: 2 },
      INT: { score: 10, modifier: 0 },
      WIS: { score: 12, modifier: 1 },
      CHA: { score: 18, modifier: 4 },
    };
    const mechanics = deriveClassMechanics(
      {
        classSlug: 'warlock',
        edition: '2024',
        level: 5,
        eldritchInvocations: [
          'agonizing-blast',
          'eldritch-spear',
          'repelling-blast',
        ],
        featChoices: {
          'invocation:agonizing-blast': { targets: ['eldritch-blast'] },
          'invocation:eldritch-spear': { targets: ['eldritch-blast'] },
          'invocation:repelling-blast': { targets: ['eldritch-blast'] },
        },
      },
      abilities,
    );

    it('adds Charisma to each beam, extends range by 30 feet per level and pushes', () => {
      const action = resolveCantripAction({
        ...base,
        characterLevel: 5,
        slug: 'eldritch-blast',
        cantripEffects: mechanics.cantripEffects,
      })!;
      expect(action).toMatchObject({
        attacks: 2,
        dice: '1d10',
        damageBonus: 4,
        damageNotation: '1d10+4',
        rangeFeet: 270, // 120 + 30 x Warlock level 5
        pushFeet: 10,
        requiresHit: true,
        targetSizeLimit: 'Large',
      });
      expect(action.notes).toHaveLength(3);
    });

    it('does not apply the effects to a cantrip they were not chosen for', () => {
      const action = resolveCantripAction({
        ...base,
        characterLevel: 5,
        slug: 'fire-bolt',
        cantripEffects: mechanics.cantripEffects,
      })!;
      expect(action).toMatchObject({
        damageBonus: 0,
        damageNotation: '2d10',
        rangeFeet: 120,
      });
      expect(action.pushFeet).toBeUndefined();
      expect(action.notes).toEqual([]);
    });
  });
});
