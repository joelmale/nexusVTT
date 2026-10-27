import type {
  AbilityName,
  Character,
  CharacterCreationData,
} from '../types/dnd';
import { invocationTargets } from './invocations';

export interface DerivedClassMechanics {
  attacksPerAction: number;
  pactWeaponAttacks?: number;
  martialArtsDie?: number;
  sneakAttackDice?: number;
  rageDamageBonus?: number;
  criticalThreshold: number;
  cantripEffects: Record<
    string,
    {
      damageBonus?: number;
      rangeBonus?: number;
      pushFeet?: number;
      requiresHit?: boolean;
      targetSizeLimit?: 'Large';
    }
  >;
}

export function applyClassCapstone(
  abilities: Character['abilities'],
  classSlug: string,
  edition: '2014' | '2024',
  level: number,
): void {
  const increased: AbilityName[] =
    level !== 20
      ? []
      : classSlug === 'barbarian'
        ? ['STR', 'CON']
        : classSlug === 'monk' && edition === '2024'
          ? ['DEX', 'WIS']
          : [];
  for (const ability of increased) {
    const score = Math.min(
      edition === '2014' ? 24 : 25,
      abilities[ability].score + 4,
    );
    abilities[ability] = { score, modifier: Math.floor((score - 10) / 2) };
  }
}

/** Deterministic quantities; conditional damage is kept separate from base rolls. */
export function deriveClassMechanics(
  data: Pick<
    CharacterCreationData,
    | 'classSlug'
    | 'edition'
    | 'level'
    | 'eldritchInvocations'
    | 'featChoices'
    | 'subclassSlug'
  >,
  abilities: Character['abilities'],
): DerivedClassMechanics {
  const { classSlug, level, edition } = data;
  const invocations = new Set(
    (data.eldritchInvocations ?? []).map((id) =>
      id.replace(/^eldritch-invocation-/, ''),
    ),
  );
  const effects: DerivedClassMechanics['cantripEffects'] = {};
  if (classSlug === 'warlock' && edition === '2024') {
    for (const id of invocationTargets(data, 'agonizing-blast'))
      if (invocations.has('agonizing-blast'))
        effects[id] = { ...effects[id], damageBonus: abilities.CHA.modifier };
    for (const id of invocationTargets(data, 'eldritch-spear'))
      if (invocations.has('eldritch-spear'))
        effects[id] = { ...effects[id], rangeBonus: 30 * level };
    for (const id of invocationTargets(data, 'repelling-blast'))
      if (invocations.has('repelling-blast'))
        effects[id] = {
          ...effects[id],
          pushFeet: 10,
          requiresHit: true,
          targetSizeLimit: 'Large',
        };
  }
  if (classSlug === 'warlock' && edition === '2014') {
    if (invocations.has('agonizing-blast'))
      effects['eldritch-blast'] = { damageBonus: abilities.CHA.modifier };
    if (invocations.has('repelling-blast'))
      effects['eldritch-blast'] = {
        ...effects['eldritch-blast'],
        pushFeet: 10,
        requiresHit: true,
      };
  }
  const pactAttacks =
    classSlug === 'warlock' && invocations.has('thirsting-blade')
      ? edition === '2024' && invocations.has('devouring-blade')
        ? 3
        : 2
      : 1;
  const attacksPerAction =
    classSlug === 'fighter'
      ? level >= 20
        ? 4
        : level >= 11
          ? 3
          : level >= 5
            ? 2
            : 1
      : ['barbarian', 'monk', 'paladin', 'ranger'].includes(classSlug) &&
          level >= 5
        ? 2
        : 1;
  return {
    attacksPerAction,
    ...(pactAttacks > 1 ? { pactWeaponAttacks: pactAttacks } : {}),
    ...(classSlug === 'monk'
      ? {
          martialArtsDie:
            edition === '2024'
              ? level >= 17
                ? 12
                : level >= 11
                  ? 10
                  : level >= 5
                    ? 8
                    : 6
              : level >= 17
                ? 10
                : level >= 11
                  ? 8
                  : level >= 5
                    ? 6
                    : 4,
        }
      : {}),
    ...(classSlug === 'rogue' ? { sneakAttackDice: Math.ceil(level / 2) } : {}),
    ...(classSlug === 'barbarian'
      ? { rageDamageBonus: level >= 16 ? 4 : level >= 9 ? 3 : 2 }
      : {}),
    criticalThreshold:
      data.subclassSlug === 'champion' && classSlug === 'fighter' && level >= 3
        ? level >= 15
          ? 18
          : 19
        : 20,
    cantripEffects: effects,
  };
}
