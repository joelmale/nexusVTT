/**
 * Roll System Types
 * D20 rolls with advantage/disadvantage mechanics
 */

/**
 * Final roll state after aggregating all advantage/disadvantage sources
 */
export type RollState = 'normal' | 'advantage' | 'disadvantage';

/**
 * Source of advantage for a roll
 */
export interface AdvantageSource {
  /** Source identifier (e.g., 'invisible', 'reckless-attack', 'help-action') */
  source: string;
  /** Optional description of why this grants advantage */
  reason?: string;
}

/**
 * Source of disadvantage for a roll
 */
export interface DisadvantageSource {
  /** Source identifier (e.g., 'prone', 'poisoned', 'restrained') */
  source: string;
  /** Optional description of why this grants disadvantage */
  reason?: string;
}

/**
 * Roll context with all modifiers and advantage/disadvantage sources
 */
export interface RollContext {
  /** Type of roll being made */
  rollType: 'attack' | 'save' | 'check' | 'initiative';

  /** Sources granting advantage */
  advantageSources: AdvantageSource[];

  /** Sources granting disadvantage */
  disadvantageSources: DisadvantageSource[];

  /** Flat bonuses to the roll */
  bonuses: number[];

  /** Additional context (optional) */
  context?: {
    /** Target AC for attack rolls */
    targetAC?: number;
    /** Save DC for saving throws */
    saveDC?: number;
    /** Ability being used for the roll */
    ability?: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';
    /** Skill being used for checks */
    skill?: string;
  };
}

/**
 * Result of a d20 roll
 */
export interface RollResult {
  /** The two d20 rolls (advantage/disadvantage rolls both, normal rolls once) */
  rolls: [number] | [number, number];

  /** The final d20 value used (after advantage/disadvantage) */
  finalRoll: number;

  /** Total including all bonuses */
  total: number;

  /** Flat bonuses applied */
  bonuses: number[];

  /** Roll state that was applied */
  rollState: RollState;

  /** Sources of advantage */
  advantageSources: AdvantageSource[];

  /** Sources of disadvantage */
  disadvantageSources: DisadvantageSource[];

  /** Whether this was a natural 20 */
  isNaturalTwenty: boolean;

  /** Whether this was a natural 1 */
  isNaturalOne: boolean;

  /** Whether this is a critical hit (nat 20 or Champion Fighter 19-20) */
  isCriticalHit?: boolean;
}
