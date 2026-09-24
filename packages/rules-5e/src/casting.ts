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

  // 2. Validate spell knowledge / preparation
  if (spell.level > 0) {
    const isPrepared = profile.preparedSpellSlugs.some(
      (s: string) => s.toLowerCase() === spell.slug.toLowerCase(),
    );
    const isKnown = profile.knownSpellSlugs.some(
      (s: string) => s.toLowerCase() === spell.slug.toLowerCase(),
    );

    if (profile.preparationMode === 'prepared' && !isPrepared) {
      reasons.push(`Spell '${spell.name}' is not currently prepared.`);
    } else if (profile.preparationMode === 'known' && !isKnown) {
      reasons.push(`Spell '${spell.name}' is not in known spells.`);
    }
  }

  // 3. Upcast level validation
  if (castAtLevel < spell.level) {
    reasons.push(
      `Cannot cast a level ${spell.level} spell at slot level ${castAtLevel}.`,
    );
  }

  // 4. Resource pool and slot availability check
  let poolIdToCharge: string | undefined;
  let slotLevelToCharge: number | undefined;

  if (spell.level > 0) {
    const pool = actor.resourcePools[profile.resourcePoolId];
    if (!pool) {
      reasons.push(
        `Associated resource pool '${profile.resourcePoolId}' not found on actor.`,
      );
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
        poolIdToCharge = pool.id;
      }
    }
  }

  // 5. Concentration transition check
  const willBreakConcentration =
    spell.concentration && !!actor.concentration;
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
