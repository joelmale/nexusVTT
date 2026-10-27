import { describe, expect, it } from 'vitest';
import { calculateCharacterStats } from '../utils/characterCreationUtils';
import { REFERENCE_BUILDS } from '../tests/fixtures/referenceBuilds';
import { applyClassCapstone, deriveClassMechanics } from './classMechanics';

const abilities = () =>
  calculateCharacterStats(REFERENCE_BUILDS.F24.creationData).abilities;
const input = (
  classSlug: string,
  level: number,
  edition: '2014' | '2024' = '2024',
) => ({ classSlug, level, edition });

describe('class quantities from SRD 5.1 and 5.2.1', () => {
  it.each(['2014', '2024'] as const)(
    'keeps Fighter attack breakpoints in %s',
    (edition) => {
      expect(
        [1, 4, 5, 10, 11, 19, 20].map(
          (level) =>
            deriveClassMechanics(input('fighter', level, edition), abilities())
              .attacksPerAction,
        ),
      ).toEqual([1, 1, 2, 2, 3, 3, 4]);
      expect(
        deriveClassMechanics(input('wizard', 20, edition), abilities())
          .attacksPerAction,
      ).toBe(1);
    },
  );
  it('does not apply Pact weapon extra attacks to other weapons', () => {
    expect(
      deriveClassMechanics(
        {
          ...input('warlock', 5, '2014'),
          eldritchInvocations: ['eldritch-invocation-thirsting-blade'],
        },
        abilities(),
      ),
    ).toMatchObject({ attacksPerAction: 1, pactWeaponAttacks: 2 });
    const derived = deriveClassMechanics(
      {
        ...input('warlock', 12),
        eldritchInvocations: ['thirsting-blade', 'devouring-blade'],
      },
      abilities(),
    );
    expect(derived).toMatchObject({
      attacksPerAction: 1,
      pactWeaponAttacks: 3,
    });
    expect(
      deriveClassMechanics(
        { ...input('warlock', 5), eldritchInvocations: ['thirsting-blade'] },
        abilities(),
      ).pactWeaponAttacks,
    ).toBe(2);
  });
  it('distinguishes legacy and revised Martial Arts dice at every breakpoint', () => {
    const levels = [1, 4, 5, 10, 11, 16, 17, 20];
    for (const [edition, expected] of [
      ['2014', [4, 4, 6, 6, 8, 8, 10, 10]],
      ['2024', [6, 6, 8, 8, 10, 10, 12, 12]],
    ] as const)
      expect(
        levels.map(
          (level) =>
            deriveClassMechanics(input('monk', level, edition), abilities())
              .martialArtsDie,
        ),
      ).toEqual(expected);
  });
  it('derives Rage, Sneak Attack and Champion critical thresholds', () => {
    expect(
      [1, 8, 9, 15, 16, 20].map(
        (level) =>
          deriveClassMechanics(input('barbarian', level), abilities())
            .rageDamageBonus,
      ),
    ).toEqual([2, 2, 3, 3, 4, 4]);
    expect(
      [1, 2, 3, 19, 20].map(
        (level) =>
          deriveClassMechanics(input('rogue', level), abilities())
            .sneakAttackDice,
      ),
    ).toEqual([1, 1, 2, 10, 10]);
    expect(
      [2, 3, 14, 15].map(
        (level) =>
          deriveClassMechanics(
            { ...input('fighter', level), subclassSlug: 'champion' },
            abilities(),
          ).criticalThreshold,
      ),
    ).toEqual([20, 19, 19, 18]);
  });
  it('applies capstone increases only at level 20 with edition-specific caps', () => {
    const legacy = abilities();
    legacy.STR = { score: 22, modifier: 6 };
    applyClassCapstone(legacy, 'barbarian', '2014', 19);
    expect(legacy.STR.score).toBe(22);
    applyClassCapstone(legacy, 'barbarian', '2014', 20);
    expect(legacy.STR).toEqual({ score: 24, modifier: 7 });
    const modern = abilities();
    modern.DEX = { score: 22, modifier: 6 };
    applyClassCapstone(modern, 'monk', '2024', 20);
    expect(modern.DEX).toEqual({ score: 25, modifier: 7 });
    const untouched = structuredClone(modern);
    applyClassCapstone(modern, 'monk', '2014', 20);
    expect(modern).toEqual(untouched);
  });
  it('keeps cantrip invocation effects tied to their own selected targets', () => {
    const stats = abilities();
    stats.CHA = { score: 18, modifier: 4 };
    const result = deriveClassMechanics(
      {
        ...input('warlock', 5),
        eldritchInvocations: [
          'agonizing-blast',
          'eldritch-spear',
          'repelling-blast',
        ],
        featChoices: {
          'invocation:agonizing-blast': { targets: ['eldritch-blast'] },
          'invocation:eldritch-spear': { targets: ['fire-bolt'] },
          'invocation:repelling-blast': { targets: ['eldritch-blast'] },
        },
      },
      stats,
    );
    expect(result.cantripEffects).toEqual({
      'eldritch-blast': {
        damageBonus: 4,
        pushFeet: 10,
        requiresHit: true,
        targetSizeLimit: 'Large',
      },
      'fire-bolt': { rangeBonus: 150 },
    });
  });
});
