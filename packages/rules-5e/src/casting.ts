/**
 * Headless Spellcasting Evaluation Engine.
 * Validates casting eligibility, slot expenditure, upcast validation, and concentration transitions.
 */

import type {
  CampaignActor,
  SpellDefinition,
  SpellcastingProfile,
} from '@nexus/game-contracts';

export interface CastEvaluationRequest {
  actor: CampaignActor;
  spell: SpellDefinition;
  profileId: string;
  castAtLevel: number;
}

export interface CastEvaluationResult {
  canCast: boolean;
  reasons: string[];
  poolIdToCharge?: string;
  slotLevelToCharge?: number;
  willBreakConcentration: boolean;
  breaksConcentrationOn?: string;
}

/**
 * Evaluates whether an actor can legally cast a spell through a specified profile.
 */
export function evaluateCastEligibility(
  request: CastEvaluationRequest,
): CastEvaluationResult {
  const { actor, spell, profileId, castAtLevel } = request;
  const reasons: string[] = [];

  // 1. Locate profile on actor
  const profile = actor.spellcastingProfiles.find(
    (p: SpellcastingProfile) => p.profileId === profileId,
  );
  if (!profile) {
    return {
      canCast: false,
      reasons: [`Actor does not have spellcasting profile '${profileId}'.`],
      willBreakConcentration: false,
    };
  }

  // Every casting source must actually grant the spell, including cantrips.
  const slug = spell.slug.toLowerCase();
  const known = profile.knownSpellSlugs.some(
    (value) => value.toLowerCase() === slug,
  );
  const prepared = profile.preparedSpellSlugs.some(
    (value) => value.toLowerCase() === slug,
  );
  if (spell.level === 0 && !known)
    reasons.push(`Cantrip '${spell.name}' is not in known spells.`);
  else if (
    spell.level > 0 &&
    profile.preparationMode === 'prepared' &&
    !prepared
  )
    reasons.push(`Spell '${spell.name}' is not currently prepared.`);
  else if (spell.level > 0 && profile.preparationMode === 'known' && !known)
    reasons.push(`Spell '${spell.name}' is not in known spells.`);
  else if (
    spell.level > 0 &&
    ['innate', 'always_prepared'].includes(profile.preparationMode) &&
    !known &&
    !prepared
  )
    reasons.push(
      `Spell '${spell.name}' is not granted by this casting source.`,
    );

  if (!Number.isInteger(castAtLevel) || castAtLevel < 0 || castAtLevel > 9)
    reasons.push('Cast level must be an integer from 0 to 9.');
  if (spell.level === 0 && castAtLevel !== 0)
    reasons.push('Cantrips must be cast at level 0.');
  if (castAtLevel < spell.level)
    reasons.push(
      `Cannot cast a level ${spell.level} spell at slot level ${castAtLevel}.`,
    );

  // 4. Resource pool and slot availability check
  let poolIdToCharge: string | undefined;
  let slotLevelToCharge: number | undefined;

  if (spell.level > 0) {
    const pool = actor.resourcePools[profile.resourcePoolId];
    if (!pool) {
      reasons.push(
        `Associated resource pool '${profile.resourcePoolId}' not found on actor.`,
      );
    } else if (pool.poolType === 'at-will') {
      if (castAtLevel !== spell.level)
        reasons.push('At-will grants cannot be upcast.');
      if (profile.ritualOnly && !spell.ritual)
        reasons.push('This source grants ritual casting only.');
    } else if (pool.poolType === 'slots') {
      const slotInfo = pool.slots?.[castAtLevel];
      if (!slotInfo || slotInfo.current <= 0) {
        reasons.push(`No level ${castAtLevel} spell slots remaining.`);
      } else {
        poolIdToCharge = pool.id;
        slotLevelToCharge = castAtLevel;
      }
    } else if (pool.poolType === 'pact') {
      if ((pool.current ?? 0) <= 0) {
        reasons.push(`No Pact Magic slots remaining.`);
      } else {
        const levels = Object.entries(pool.slots || {})
          .filter(([, value]) => value.total > 0)
          .map(([level]) => Number(level));
        if (levels.length !== 1 || levels[0] !== castAtLevel)
          reasons.push(
            'Cast level must match the available Pact Magic slot level.',
          );
        else if ((pool.slots?.[castAtLevel]?.current ?? 0) <= 0)
          reasons.push('No Pact Magic slots remaining.');
        else {
          poolIdToCharge = pool.id;
          slotLevelToCharge = castAtLevel;
        }
      }
    } else if (
      pool.poolType === 'uses' &&
      ['innate', 'always_prepared'].includes(profile.preparationMode)
    ) {
      if (castAtLevel !== spell.level)
        reasons.push('This granted casting cannot be upcast.');
      if ((pool.current ?? 0) <= 0)
        reasons.push('No granted spell uses remaining.');
      else poolIdToCharge = pool.id;
    } else {
      reasons.push('This resource pool cannot pay for spellcasting.');
    }
  }

  // 5. Concentration transition check
  const willBreakConcentration = spell.concentration && !!actor.concentration;
  const breaksConcentrationOn = willBreakConcentration
    ? actor.concentration?.spellName
    : undefined;

  return {
    canCast: reasons.length === 0,
    reasons,
    poolIdToCharge,
    slotLevelToCharge,
    willBreakConcentration,
    breaksConcentrationOn,
  };
}
