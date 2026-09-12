/**
 * Effect system for character modifications
 * Effects are the core mechanism for applying rules to characters
 */

import type {
  Ability,
  BonusType,
  EffectPriority,
  MovementType,
  ProficiencyType,
  ResourceType,
  SenseType,
  Skill,
  SpellcastingType,
  StackingRule,
} from './common';
import type { Formula } from './formulas';
import type { Predicate } from './predicates';

/**
 * Base effect interface with common fields
 */
interface BaseEffect {
  predicate?: Predicate[];
  priority?: EffectPriority;
}

/**
 * Grant proficiency effect
 */
export interface GrantProficiencyEffect extends BaseEffect {
  kind: 'grantProficiency';
  profType: ProficiencyType;
  values: string[];
}

/**
 * Ability score increase effect
 */
export interface AbilityScoreIncreaseEffect extends BaseEffect {
  kind: 'abilityScoreIncrease';
  ability: Ability;
  value: number | Formula;
}

/**
 * Saving throw advantage effect
 */
export interface SaveAdvantageEffect extends BaseEffect {
  kind: 'saveAdvantage';
  abilities: Ability[];
}

/**
 * Saving throw bonus effect
 */
export interface SaveBonusEffect extends BaseEffect {
  kind: 'saveBonus';
  abilities: Ability[];
  value: number | Formula;
  stacking: StackingRule;
  bonusType?: BonusType;
}

/**
 * Skill proficiency effect
 */
export interface SkillProficiencyEffect extends BaseEffect {
  kind: 'skillProficiency';
  skill: Skill;
}

/**
 * Skill expertise effect
 */
export interface SkillExpertiseEffect extends BaseEffect {
  kind: 'skillExpertise';
  skill: Skill;
}

/**
 * Skill bonus effect
 */
export interface SkillBonusEffect extends BaseEffect {
  kind: 'skillBonus';
  skill: Skill;
  value: number | Formula;
  stacking: StackingRule;
  bonusType?: BonusType;
}

/**
 * Armor class effect
 */
export interface ArmorClassEffect extends BaseEffect {
  kind: 'armorClass';
  value: number | Formula;
  stacking?: StackingRule;
  bonusType?: BonusType;
}

/**
 * Initiative bonus effect
 */
export interface InitiativeBonusEffect extends BaseEffect {
  kind: 'initiativeBonus';
  value: number | Formula;
  stacking: StackingRule;
  bonusType?: BonusType;
}

/**
 * Speed effect
 */
export interface SpeedEffect extends BaseEffect {
  kind: 'speed';
  movementType: MovementType;
  value: number | Formula;
  stacking?: StackingRule;
}

/**
 * Sense effect
 */
export interface SenseEffect extends BaseEffect {
  kind: 'sense';
  senseType: SenseType;
  range: number;
  stacking?: StackingRule;
}

/**
 * Resource effect
 */
export interface ResourceEffect extends BaseEffect {
  kind: 'resource';
  resourceId: string;
  resourceType: ResourceType;
  value: number | Formula;
  level?: number; // For spell slots
}

/**
 * Spellcasting ability effect
 */
export interface SpellcastingAbilityEffect extends BaseEffect {
  kind: 'spellcastingAbility';
  ability: Ability;
}

/**
 * Grant spell effect
 */
export interface GrantSpellEffect extends BaseEffect {
  kind: 'grantSpell';
  spellSlug: string;
  spellcastingType?: SpellcastingType;
  spellType?: 'cantrip' | 'known' | 'alwaysPrepared' | 'prepared';
  usesSpellSlot?: boolean;
}

/**
 * Spell slots effect
 */
export interface SpellSlotsEffect extends BaseEffect {
  kind: 'spellSlots';
  level: number; // Spell level (1-9)
  value: number | Formula;
  stacking: StackingRule;
}

/**
 * Grant feature effect
 */
export interface GrantFeatureEffect extends BaseEffect {
  kind: 'grantFeature';
  featureId: string;
  name: string;
  description: string;
}

/**
 * Tag effect
 */
export interface TagEffect extends BaseEffect {
  kind: 'tag';
  tags: string[];
}

/**
 * Equipment restriction effect
 */
export interface EquipmentRestrictionEffect extends BaseEffect {
  kind: 'equipmentRestriction';
  restrictionType: 'cannotWear' | 'cannotWield' | 'requiresAttunement';
  itemTags: string[];
}

/**
 * Condition effect
 */
export interface ConditionEffect extends BaseEffect {
  kind: 'condition';
  condition: string;
}

/**
 * Hit point maximum modifier effect
 */
export interface HitPointMaxEffect extends BaseEffect {
  kind: 'hitPointMax';
  value: number | Formula;
  stacking: StackingRule;
}

export interface HitPointsEffect extends BaseEffect {
  kind: 'hitPoints';
  value: number | Formula;
  stacking?: StackingRule;
}

export interface DamageResistanceEffect extends BaseEffect {
  kind: 'damageResistance';
  damageType: string;
}

export interface ConditionImmunityEffect extends BaseEffect {
  kind: 'conditionImmunity';
  condition: string;
}

export interface SavingThrowBonusEffect extends BaseEffect {
  kind: 'savingThrowBonus';
  ability: Ability | 'all';
  value: number | Formula;
  stacking?: StackingRule;
  bonusType?: BonusType;
}

/**
 * Union type for all effects
 */
export type Effect =
  | GrantProficiencyEffect
  | AbilityScoreIncreaseEffect
  | SaveAdvantageEffect
  | SaveBonusEffect
  | SavingThrowBonusEffect
  | SkillProficiencyEffect
  | SkillExpertiseEffect
  | SkillBonusEffect
  | ArmorClassEffect
  | InitiativeBonusEffect
  | SpeedEffect
  | SenseEffect
  | ResourceEffect
  | SpellcastingAbilityEffect
  | GrantSpellEffect
  | SpellSlotsEffect
  | GrantFeatureEffect
  | TagEffect
  | EquipmentRestrictionEffect
  | ConditionEffect
  | HitPointMaxEffect
  | HitPointsEffect
  | DamageResistanceEffect
  | ConditionImmunityEffect;

/**
 * Choice option for effects that require player selection
 */
export interface ChoiceOption {
  value: string;
  label: string;
  description?: string;
  effects?: Effect[];
}

/**
 * Effect choice definition
 */
export interface EffectChoice {
  id: string;
  prompt: string;
  type: 'select' | 'multiselect' | 'number' | 'text';
  options?: ChoiceOption[];
  min?: number;
  max?: number;
  predicate?: Predicate[];
}

/**
 * Sourced effect with metadata
 */
export interface SourcedEffect {
  /**
   * Unique identifier for the source
   * Format: "type:slug" (e.g., "species:gnome", "class:bard", "feat:alert")
   */
  sourceId: string;

  /**
   * Unique identifier for this effect within the source
   */
  effectId: string;

  /**
   * Human-readable name
   */
  name: string;

  /**
   * Optional description/flavor text
   */
  description?: string;

  /**
   * Effects to apply
   */
  effects?: Effect[];

  /**
   * Optional choice that must be made for this effect
   */
  choice?: EffectChoice;

  /**
   * Edition filter ('2014', '2024', or 'both')
   */
  edition?: '2014' | '2024' | 'both';

  /**
   * Optional icon for UI
   */
  icon?: string;
}

/**
 * Duration for temporary effects
 */
export type Duration =
  | { type: 'permanent' }
  | { type: 'rounds'; count: number }
  | { type: 'minutes'; count: number }
  | { type: 'hours'; count: number }
  | { type: 'untilLongRest' }
  | { type: 'untilShortRest' }
  | { type: 'concentration'; maxDuration: Duration };

/**
 * Temporary effect with duration
 */
export interface TemporaryEffect extends SourcedEffect {
  duration: Duration;
  appliedAt: number; // timestamp
}

/**
 * Type guards for effect discrimination
 */
export function isGrantProficiencyEffect(effect: Effect): effect is GrantProficiencyEffect {
  return effect.kind === 'grantProficiency';
}

export function isAbilityScoreIncreaseEffect(effect: Effect): effect is AbilityScoreIncreaseEffect {
  return effect.kind === 'abilityScoreIncrease';
}

export function isSaveAdvantageEffect(effect: Effect): effect is SaveAdvantageEffect {
  return effect.kind === 'saveAdvantage';
}

export function isSkillProficiencyEffect(effect: Effect): effect is SkillProficiencyEffect {
  return effect.kind === 'skillProficiency';
}

export function isSkillExpertiseEffect(effect: Effect): effect is SkillExpertiseEffect {
  return effect.kind === 'skillExpertise';
}

export function isTagEffect(effect: Effect): effect is TagEffect {
  return effect.kind === 'tag';
}
