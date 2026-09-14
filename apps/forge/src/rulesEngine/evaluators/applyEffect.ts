/**
 * Effect Application System
 * Applies individual effects to derived state
 *
 * PURE SEPARATION RULE: This module contains NO game-specific logic.
 * All rules come from effect data. This is purely a dispatcher.
 */

import type { Effect, SourcedEffect } from '../types/effects';
import type { BaseFacts } from '../types/baseFacts';
import type { DerivedState, ProvenanceEntry } from '../types/derived';
import type { StackingRule } from '../types/common';
import { evaluatePredicates, type PredicateContext } from './predicates';
import { recalculateAbilityModifiers } from '../utils/initializeDerivedState';
import { evaluateFormula, createFormulaContext } from './formulas';
import { isFormula } from '../types/formulas';

/**
 * Apply a sourced effect to derived state
 * Checks predicates and dispatches to specific effect handlers
 *
 * @param facts - Base character facts
 * @param derived - Derived state (mutated)
 * @param sourced - Effect to apply with metadata
 */
export function applySourcedEffect(
  facts: BaseFacts,
  derived: DerivedState,
  sourced: SourcedEffect
): void {
  // Check edition filter
  if (sourced.edition && sourced.edition !== 'both' && sourced.edition !== facts.edition) {
    logEffectNotApplied(derived, sourced, `Edition mismatch (requires ${sourced.edition})`);
    return;
  }

  // Handle choice resolution (deferred to future phases)
  if (sourced.choice) {
    const choiceValue = facts.choices[sourced.choice.id];
    if (!choiceValue) {
      logEffectNotApplied(derived, sourced, `Choice not made: ${sourced.choice.id}`);
      return;
    }
    // Apply choice-specific effects
    applyChoiceEffects(facts, derived, sourced, choiceValue);
    return;
  }

  // Apply each effect in the sourced effect
  for (const effect of sourced.effects || []) {
    applyEffect(facts, derived, sourced, effect);
  }
}

/**
 * Apply a single effect to derived state
 *
 * @param facts - Base character facts
 * @param derived - Derived state (mutated)
 * @param sourced - Source metadata
 * @param effect - Effect to apply
 */
export function applyEffect(
  facts: BaseFacts,
  derived: DerivedState,
  sourced: SourcedEffect,
  effect: Effect
): void {
  // Check predicates
  if (effect.predicate) {
    const context: PredicateContext = { facts, derived };
    if (!evaluatePredicates(effect.predicate, context)) {
      logEffectNotApplied(derived, sourced, 'Predicate failed');
      return;
    }
  }

  // Dispatch to specific effect handler
  switch (effect.kind) {
    case 'grantProficiency': {
      applyGrantProficiency(derived, sourced, effect);
      break;
    }

    case 'abilityScoreIncrease': {
      applyAbilityScoreIncrease(facts, derived, sourced, effect);
      break;
    }

    case 'tag': {
      applyTag(derived, sourced, effect);
      break;
    }

    case 'sense': {
      applySense(derived, sourced, effect);
      break;
    }

    case 'grantFeature': {
      applyGrantFeature(derived, sourced, effect);
      break;
    }

    case 'speed': {
      applySpeed(facts, derived, sourced, effect);
      break;
    }

    case 'saveAdvantage': {
      applySaveAdvantage(derived, sourced, effect);
      break;
    }

    case 'saveBonus': {
      applySaveBonus(facts, derived, sourced, effect);
      break;
    }

    case 'savingThrowBonus': {
      applySavingThrowBonus(facts, derived, sourced, effect);
      break;
    }

    case 'skillProficiency': {
      applySkillProficiency(derived, sourced, effect);
      break;
    }

    case 'skillExpertise': {
      applySkillExpertise(derived, sourced, effect);
      break;
    }

    case 'skillBonus': {
      applySkillBonus(facts, derived, sourced, effect);
      break;
    }

    case 'spellcastingAbility': {
      applySpellcastingAbility(derived, sourced, effect);
      break;
    }

    case 'grantSpell': {
      applyGrantSpell(derived, sourced, effect);
      break;
    }

    case 'spellSlots': {
      applySpellSlots(facts, derived, sourced, effect);
      break;
    }

    case 'resource': {
      applyResource(facts, derived, sourced, effect);
      break;
    }

    case 'armorClass': {
      applyArmorClass(facts, derived, sourced, effect);
      break;
    }

    case 'initiativeBonus': {
      applyInitiativeBonus(facts, derived, sourced, effect);
      break;
    }

    case 'equipmentRestriction': {
      applyEquipmentRestriction(derived, sourced, effect);
      break;
    }

    case 'condition': {
      applyCondition(derived, sourced, effect);
      break;
    }

    case 'hitPointMax': {
      applyHitPointMax(facts, derived, sourced, effect);
      break;
    }

    case 'hitPoints': {
      applyHitPointMax(facts, derived, sourced, { ...effect, kind: 'hitPointMax', stacking: effect.stacking || 'stack' });
      break;
    }

    case 'damageResistance': {
      applyDamageResistance(derived, sourced, effect);
      break;
    }

    case 'conditionImmunity': {
      applyConditionImmunity(derived, sourced, effect);
      break;
    }

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = effect;
      logEffectNotApplied(derived, sourced, `Unknown effect kind: ${JSON.stringify(_exhaustive)}`);
      break;
    }
  }
}

/**
 * Apply grantProficiency effect
 */
function applyGrantProficiency(
  derived: DerivedState,
  sourced: SourcedEffect,
  effect: Extract<Effect, { kind: 'grantProficiency' }>
): void {
  // Map ProficiencyType to DerivedProficiencies key
  const keyMap: Record<string, keyof DerivedState['proficiencies']> = {
    armor: 'armor',
    weapon: 'weapons',
    tool: 'tools',
    language: 'languages',
    savingThrow: 'savingThrows',
    skill: 'skills',
  };

  const key = keyMap[effect.profType];
  if (!key) {
    logEffectNotApplied(derived, sourced, `Unknown proficiency type: ${effect.profType}`);
    return;
  }

  const targetArray = derived.proficiencies[key];

  for (const value of effect.values) {
    if (!targetArray.includes(value as never)) {
      targetArray.push(value as never);
    }
  }

  logEffectApplied(derived, sourced, effect.values);
}

/**
 * Apply abilityScoreIncrease effect
 */
function applyAbilityScoreIncrease(
  facts: BaseFacts,
  derived: DerivedState,
  sourced: SourcedEffect,
  effect: Extract<Effect, { kind: 'abilityScoreIncrease' }>
): void {
  const currentScore = derived.abilities[effect.ability].score;
  const value = resolveEffectValue(effect.value, facts, derived);
  derived.abilities[effect.ability].score = currentScore + value;

  // Recalculate modifier
  recalculateAbilityModifiers(derived);

  logEffectApplied(derived, sourced, `+${value} ${effect.ability}`);
}

/**
 * Apply tag effect
 */
function applyTag(
  derived: DerivedState,
  sourced: SourcedEffect,
  effect: Extract<Effect, { kind: 'tag' }>
): void {
  for (const tag of effect.tags) {
    if (!derived.tags.includes(tag)) {
      derived.tags.push(tag);
    }
  }

  logEffectApplied(derived, sourced, effect.tags);
}

/**
 * Apply sense effect
 */
function applySense(
  derived: DerivedState,
  sourced: SourcedEffect,
  effect: Extract<Effect, { kind: 'sense' }>
): void {
  // Check if this sense already exists
  const existing = derived.senses.find(s => s.type === effect.senseType);

  if (existing) {
    // Keep the longer range
    if (effect.range > existing.range) {
      existing.range = effect.range;
      if (!existing.sources.includes(sourced.sourceId)) {
        existing.sources.push(sourced.sourceId);
      }
    }
  } else {
    // Add new sense
    derived.senses.push({
      type: effect.senseType,
      range: effect.range,
      sources: [sourced.sourceId],
    });
  }

  logEffectApplied(derived, sourced, `${effect.senseType} ${effect.range}ft`);
}

/**
 * Apply grantFeature effect
 */
function applyGrantFeature(
  derived: DerivedState,
  sourced: SourcedEffect,
  effect: Extract<Effect, { kind: 'grantFeature' }>
): void {
  // Check if feature already exists
  const existing = derived.features.find(f => f.id === effect.featureId);
  if (existing) {
    // Already granted
    return;
  }

  derived.features.push({
    id: effect.featureId,
    name: effect.name,
    description: effect.description,
    source: sourced.sourceId,
  });

  logEffectApplied(derived, sourced, effect.name);
}

/**
 * Apply speed effect
 */
function applySpeed(
  facts: BaseFacts,
  derived: DerivedState,
  sourced: SourcedEffect,
  effect: Extract<Effect, { kind: 'speed' }>
): void {
  const speedValue = resolveEffectValue(effect.value, facts, derived);
  const current = derived.speed[effect.movementType] ?? 0;

  // Priority system: 'flag' forces value (for conditions), otherwise take highest
  if (effect.priority === 'flag') {
    // Unconditionally set speed (for conditions that force speed to 0)
    derived.speed[effect.movementType] = speedValue;
    logEffectApplied(derived, sourced, `${effect.movementType} set to ${speedValue}ft (forced)`);
  } else {
    // Take the highest value (for speed bonuses)
    if (speedValue > current) {
      derived.speed[effect.movementType] = speedValue;
      logEffectApplied(derived, sourced, `${effect.movementType} ${speedValue}ft`);
    } else {
      logEffectNotApplied(derived, sourced, `${effect.movementType} ${speedValue}ft (lower than current ${current}ft)`);
    }
  }
}

/**
 * Apply choice-specific effects
 */
function applyChoiceEffects(
  facts: BaseFacts,
  derived: DerivedState,
  sourced: SourcedEffect,
  choiceValue: string | string[] | number
): void {
  if (!sourced.choice) return;

  // Find the selected option(s)
  const options = sourced.choice.options ?? [];

  if (Array.isArray(choiceValue)) {
    // Multiple selections
    for (const value of choiceValue) {
      const option = options.find(o => o.value === value);
      if (option?.effects) {
        for (const effect of option.effects) {
          applyEffect(facts, derived, sourced, effect);
        }
      }
    }
  } else {
    // Single selection
    const option = options.find(o => o.value === String(choiceValue));
    if (option?.effects) {
      for (const effect of option.effects) {
        applyEffect(facts, derived, sourced, effect);
      }
    }
  }

  logEffectApplied(derived, sourced, `Choice: ${JSON.stringify(choiceValue)}`);
}

/**
 * Apply saveAdvantage effect
 */
function applySaveAdvantage(
  derived: DerivedState,
  sourced: SourcedEffect,
  effect: Extract<Effect, { kind: 'saveAdvantage' }>
): void {
  for (const ability of effect.abilities) {
    const save = derived.saves[ability];
    if (!save.advantage.includes(sourced.sourceId)) {
      save.advantage.push(sourced.sourceId);
    }
  }

  logEffectApplied(derived, sourced, `Advantage on ${effect.abilities.join(', ')} saves`);
}

/**
 * Apply saveBonus effect
 */
function applySaveBonus(
  facts: BaseFacts,
  derived: DerivedState,
  sourced: SourcedEffect,
  effect: Extract<Effect, { kind: 'saveBonus' }>
): void {
  const bonusValue = resolveEffectValue(effect.value, facts, derived);

  for (const ability of effect.abilities) {
    const save = derived.saves[ability];

    // Apply stacking rules
    if (effect.stacking === 'stack') {
      save.bonus += bonusValue;
    } else if (effect.stacking === 'max') {
      save.bonus = Math.max(save.bonus, bonusValue);
    }
  }

  logEffectApplied(derived, sourced, `+${bonusValue} to ${effect.abilities.join(', ')} saves`);
}

/**
 * Apply savingThrowBonus effect
 */
function applySavingThrowBonus(
  facts: BaseFacts,
  derived: DerivedState,
  sourced: SourcedEffect,
  effect: Extract<Effect, { kind: 'savingThrowBonus' }>
): void {
  const bonusValue = resolveEffectValue(effect.value, facts, derived);
  const abilities = effect.ability === 'all'
    ? (Object.keys(derived.saves) as Array<keyof DerivedState['saves']>)
    : [effect.ability];
  const stacking = effect.stacking || 'stack';

  for (const ability of abilities) {
    const save = derived.saves[ability];
    if (stacking === 'stack') {
      save.bonus += bonusValue;
    } else if (stacking === 'max') {
      save.bonus = Math.max(save.bonus, bonusValue);
    }
  }

  logEffectApplied(derived, sourced, `+${bonusValue} to ${abilities.join(', ')} saves`);
}

/**
 * Apply skillProficiency effect
 */
function applySkillProficiency(
  derived: DerivedState,
  sourced: SourcedEffect,
  effect: Extract<Effect, { kind: 'skillProficiency' }>
): void {
  const skill = effect.skill;

  // Add to proficiencies array
  if (!derived.proficiencies.skills.includes(skill)) {
    derived.proficiencies.skills.push(skill);
  }

  // Mark skill as proficient
  derived.skills[skill].proficient = true;

  logEffectApplied(derived, sourced, `Proficiency in ${skill}`);
}

/**
 * Apply skillExpertise effect
 */
function applySkillExpertise(
  derived: DerivedState,
  sourced: SourcedEffect,
  effect: Extract<Effect, { kind: 'skillExpertise' }>
): void {
  const skill = effect.skill;

  // Expertise implicitly grants proficiency if not already proficient
  if (!derived.skills[skill].proficient) {
    if (!derived.proficiencies.skills.includes(skill)) {
      derived.proficiencies.skills.push(skill);
    }
    derived.skills[skill].proficient = true;
  }

  // Add to expertise array
  if (!derived.expertise.skills.includes(skill)) {
    derived.expertise.skills.push(skill);
  }

  // Mark skill as expertise
  derived.skills[skill].expertise = true;

  logEffectApplied(derived, sourced, `Expertise in ${skill}`);
}

/**
 * Apply skillBonus effect
 */
function applySkillBonus(
  facts: BaseFacts,
  derived: DerivedState,
  sourced: SourcedEffect,
  effect: Extract<Effect, { kind: 'skillBonus' }>
): void {
  const bonusValue = resolveEffectValue(effect.value, facts, derived);
  const skill = derived.skills[effect.skill];

  // Apply stacking rules
  if (effect.stacking === 'stack') {
    skill.bonus += bonusValue;
  } else if (effect.stacking === 'max') {
    skill.bonus = Math.max(skill.bonus, bonusValue);
  }

  logEffectApplied(derived, sourced, `+${bonusValue} to ${effect.skill}`);
}

/**
 * Apply spellcastingAbility effect
 */
function applySpellcastingAbility(
  derived: DerivedState,
  sourced: SourcedEffect,
  effect: Extract<Effect, { kind: 'spellcastingAbility' }>
): void {
  // Initialize spellcasting if not already present
  if (!derived.spellcasting) {
    derived.spellcasting = {
      ability: effect.ability,
      saveDC: 0, // Computed in finalizer
      attackBonus: 0, // Computed in finalizer
      slots: {},
      spellsKnown: [],
      spellsPrepared: [],
      spellsAlwaysPrepared: [],
      cantrips: [],
    };
  } else {
    // Update ability if different (multiclass edge case)
    derived.spellcasting.ability = effect.ability;
  }

  logEffectApplied(derived, sourced, `Spellcasting ability: ${effect.ability}`);
}

/**
 * Apply grantSpell effect
 */
function applyGrantSpell(
  derived: DerivedState,
  sourced: SourcedEffect,
  effect: Extract<Effect, { kind: 'grantSpell' }>
): void {
  // Ensure spellcasting exists
  if (!derived.spellcasting) {
    logEffectNotApplied(derived, sourced, 'No spellcasting ability set');
    return;
  }

  const spellSlug = effect.spellSlug;

  // Add to appropriate list based on spell type
  const spellType = effect.spellType || (
    effect.spellcastingType === 'alwaysPrepared'
      ? 'alwaysPrepared'
      : effect.spellcastingType === 'prepared'
        ? 'prepared'
        : effect.spellcastingType === 'known'
          ? 'known'
          : effect.spellcastingType === 'innate'
            ? 'known'
            : effect.spellcastingType === 'spellbook'
              ? 'known'
              : undefined
  );

  if (!spellType) {
    logEffectNotApplied(derived, sourced, 'Unknown spell type');
    return;
  }

  switch (spellType) {
    case 'cantrip': {
      if (!derived.spellcasting.cantrips.includes(spellSlug)) {
        derived.spellcasting.cantrips.push(spellSlug);
      }
      break;
    }

    case 'known': {
      if (!derived.spellcasting.spellsKnown.includes(spellSlug)) {
        derived.spellcasting.spellsKnown.push(spellSlug);
      }
      break;
    }

    case 'alwaysPrepared': {
      if (!derived.spellcasting.spellsAlwaysPrepared.includes(spellSlug)) {
        derived.spellcasting.spellsAlwaysPrepared.push(spellSlug);
      }
      break;
    }

    case 'prepared': {
      if (!derived.spellcasting.spellsPrepared.includes(spellSlug)) {
        derived.spellcasting.spellsPrepared.push(spellSlug);
      }
      break;
    }

    default:
      logEffectNotApplied(derived, sourced, `Unknown spell type: ${spellType}`);
      return;
  }

  logEffectApplied(derived, sourced, `Granted spell: ${spellSlug} (${spellType})`);
}

/**
 * Apply spellSlots effect
 */
function applySpellSlots(
  facts: BaseFacts,
  derived: DerivedState,
  sourced: SourcedEffect,
  effect: Extract<Effect, { kind: 'spellSlots' }>
): void {
  // Ensure spellcasting exists
  if (!derived.spellcasting) {
    logEffectNotApplied(derived, sourced, 'No spellcasting ability set');
    return;
  }

  const level = effect.level;
  const value = resolveEffectValue(effect.value, facts, derived);

  // Initialize slot level if not present
  if (!derived.spellcasting.slots[level]) {
    derived.spellcasting.slots[level] = { max: 0, used: 0 };
  }

  // Apply stacking rules
  if (effect.stacking === 'stack') {
    derived.spellcasting.slots[level].max += value;
  } else if (effect.stacking === 'max') {
    derived.spellcasting.slots[level].max = Math.max(
      derived.spellcasting.slots[level].max,
      value
    );
  }

  logEffectApplied(derived, sourced, `Spell slots L${level}: ${value}`);
}

/**
 * Apply resource effect
 */
function applyResource(
  facts: BaseFacts,
  derived: DerivedState,
  sourced: SourcedEffect,
  effect: Extract<Effect, { kind: 'resource' }>
): void {
  const resourceId = effect.resourceId;
  const value = resolveEffectValue(effect.value, facts, derived);
  const stacking = (effect as { stacking?: StackingRule }).stacking || 'stack';

  // Initialize resource if not present
  if (!derived.resources[resourceId]) {
    derived.resources[resourceId] = {
      id: resourceId,
      max: value,
      current: value, // Start at max
      type: effect.resourceType,
      sources: [sourced.sourceId],
    };
  } else {
    // Resource already exists, apply stacking
    if (stacking === 'stack') {
      derived.resources[resourceId].max += value;
      derived.resources[resourceId].current += value;
    } else if (stacking === 'max') {
      const oldMax = derived.resources[resourceId].max;
      const newMax = Math.max(oldMax, value);
      derived.resources[resourceId].max = newMax;
      derived.resources[resourceId].current = newMax;
    }

    // Add source if not already tracked
    if (!derived.resources[resourceId].sources.includes(sourced.sourceId)) {
      derived.resources[resourceId].sources.push(sourced.sourceId);
    }
  }

  logEffectApplied(derived, sourced, `Resource: ${resourceId} (${value} ${effect.resourceType})`);
}

/**
 * Apply armorClass effect
 */
function applyArmorClass(
  facts: BaseFacts,
  derived: DerivedState,
  sourced: SourcedEffect,
  effect: Extract<Effect, { kind: 'armorClass' }>
): void {
  const acValue = resolveEffectValue(effect.value, facts, derived);

  // Store AC contribution with priority for finalizer to process
  // We need to track all AC effects and let the finalizer determine which applies
  if (!derived.ac.sources) {
    derived.ac.sources = [];
  }

  // Add this AC contribution
  // The finalizer will pick the right one based on priority
  derived.ac.sources.push(sourced.sourceId);

  // For now, store AC contributions in a temporary structure
  // This will be processed by the AC finalizer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(derived as any).acContributions) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (derived as any).acContributions = [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (derived as any).acContributions.push({
    sourceId: sourced.sourceId,
    value: acValue,
    priority: effect.priority,
    stacking: effect.stacking,
  });

  logEffectApplied(derived, sourced, `AC ${acValue} (${effect.priority})`);
}

/**
 * Apply initiativeBonus effect
 */
function applyInitiativeBonus(
  facts: BaseFacts,
  derived: DerivedState,
  sourced: SourcedEffect,
  effect: Extract<Effect, { kind: 'initiativeBonus' }>
): void {
  const bonusValue = resolveEffectValue(effect.value, facts, derived);

  // Apply stacking rules
  if (effect.stacking === 'stack') {
    derived.initiative.bonus += bonusValue;
  } else if (effect.stacking === 'max') {
    derived.initiative.bonus = Math.max(derived.initiative.bonus, bonusValue);
  }

  // Track source
  if (!derived.initiative.advantage) {
    derived.initiative.advantage = [];
  }

  logEffectApplied(derived, sourced, `Initiative +${bonusValue}`);
}

/**
 * Resolve an effect value (number or formula)
 */
function resolveEffectValue(
  value: number | { expression: string; variables: string[] },
  facts: BaseFacts,
  derived: DerivedState
): number {
  if (typeof value === 'number') {
    return value;
  }

  if (isFormula(value)) {
    const context = createFormulaContext(facts, derived);
    return evaluateFormula(value, context);
  }

  return 0;
}

/**
 * Apply damageResistance effect
 */
function applyDamageResistance(
  derived: DerivedState,
  sourced: SourcedEffect,
  effect: Extract<Effect, { kind: 'damageResistance' }>
): void {
  const tag = `resistance:${effect.damageType}`;
  if (!derived.tags.includes(tag)) {
    derived.tags.push(tag);
  }
  logEffectApplied(derived, sourced, `Damage resistance: ${effect.damageType}`);
}

/**
 * Apply conditionImmunity effect
 */
function applyConditionImmunity(
  derived: DerivedState,
  sourced: SourcedEffect,
  effect: Extract<Effect, { kind: 'conditionImmunity' }>
): void {
  const tag = `conditionImmune:${effect.condition}`;
  if (!derived.tags.includes(tag)) {
    derived.tags.push(tag);
  }
  logEffectApplied(derived, sourced, `Condition immunity: ${effect.condition}`);
}

/**
 * Log an applied effect to provenance
 */
function logEffectApplied(
  derived: DerivedState,
  sourced: SourcedEffect,
  value?: unknown
): void {
  const entry: ProvenanceEntry = {
    sourceId: sourced.sourceId,
    effectId: sourced.effectId,
    applied: true,
    value,
  };
  derived.appliedEffects.push(entry);
}

/**
 * Apply equipmentRestriction effect
 */
function applyEquipmentRestriction(
  derived: DerivedState,
  sourced: SourcedEffect,
  effect: Extract<Effect, { kind: 'equipmentRestriction' }>
): void {
  const { restrictionType, itemTags } = effect;

  // Add item tags to appropriate restriction list
  switch (restrictionType) {
    case 'cannotWear':
      for (const tag of itemTags) {
        if (!derived.equipmentRestrictions.cannotWear.includes(tag)) {
          derived.equipmentRestrictions.cannotWear.push(tag);
        }
      }
      break;
    case 'cannotWield':
      for (const tag of itemTags) {
        if (!derived.equipmentRestrictions.cannotWield.includes(tag)) {
          derived.equipmentRestrictions.cannotWield.push(tag);
        }
      }
      break;
    case 'requiresAttunement':
      for (const tag of itemTags) {
        if (!derived.equipmentRestrictions.requiresAttunement.includes(tag)) {
          derived.equipmentRestrictions.requiresAttunement.push(tag);
        }
      }
      break;
  }

  logEffectApplied(derived, sourced, `Equipment restriction: ${restrictionType} ${itemTags.join(', ')}`);
}

/**
 * Apply condition effect
 */
function applyCondition(
  derived: DerivedState,
  sourced: SourcedEffect,
  effect: Extract<Effect, { kind: 'condition' }>
): void {
  // Add condition tag
  const conditionTag = `condition:${effect.condition}`;
  if (!derived.tags.includes(conditionTag)) {
    derived.tags.push(conditionTag);
  }

  logEffectApplied(derived, sourced, `Condition: ${effect.condition}`);
}

/**
 * Apply hitPointMax effect
 */
function applyHitPointMax(
  facts: BaseFacts,
  derived: DerivedState,
  sourced: SourcedEffect,
  effect: Extract<Effect, { kind: 'hitPointMax' }>
): void {
  const value = resolveEffectValue(effect.value, facts, derived);

  // Store HP max modifier in temporary storage (will be finalized later)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(derived as any).hpMaxModifiers) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (derived as any).hpMaxModifiers = [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (derived as any).hpMaxModifiers.push({
    sourceId: sourced.sourceId,
    value,
    stacking: effect.stacking,
  });

  logEffectApplied(derived, sourced, `HP Max modifier: ${value > 0 ? '+' : ''}${value}`);
}

/**
 * Log an effect that was not applied to provenance
 */
function logEffectNotApplied(
  derived: DerivedState,
  sourced: SourcedEffect,
  reason: string
): void {
  const entry: ProvenanceEntry = {
    sourceId: sourced.sourceId,
    effectId: sourced.effectId,
    applied: false,
    reason,
  };
  derived.appliedEffects.push(entry);
}
