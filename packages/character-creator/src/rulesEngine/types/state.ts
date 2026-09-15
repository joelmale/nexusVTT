/**
 * Character State Types
 * Mutable runtime state separate from static character data
 *
 * Character data (BaseFacts + SourcedEffect[]) is immutable descriptive data.
 * CharacterState is mutable gameplay state that changes during play.
 */

/**
 * Resource with current and maximum values
 */
export interface TrackedResource {
  /** Current value (0 to max) */
  current: number;
  /** Maximum value */
  max: number;
  /** Type of restoration (perShortRest, perLongRest, other) */
  restorationType: 'spellSlot' | 'perShortRest' | 'perLongRest' | 'perTurn' | 'unlimited' | 'perDay' | 'other';
}

/**
 * Active condition on a character
 */
export interface ActiveCondition {
  /** Condition type (prone, invisible, poisoned, etc.) */
  condition: string;
  /** Source of the condition (for tracking) */
  source?: string;
  /** Duration in rounds (optional, 0 = indefinite, 'instant' for immediate effects) */
  duration?: number | 'instant';
  /** Save DC to end condition (optional) */
  saveDC?: number;
  /** Ability used for save (optional) */
  saveAbility?: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';
}

/**
 * Concentration tracking
 */
export interface ConcentrationState {
  /** Currently concentrating on a spell/effect (null if none) */
  activeEffect: string | null;
  /** Source of concentration (spell name, feature name) */
  source: string | null;
  /** Spell level if concentrating on a spell (for damage-breaking) */
  spellLevel?: number;
}

/**
 * Action Economy tracking per turn
 */
export interface ActionEconomy {
  /** Has action available */
  hasAction: boolean;
  /** Has bonus action available */
  hasBonusAction: boolean;
  /** Has reaction available */
  hasReaction: boolean;
  /** Has movement available (in feet) */
  movementRemaining: number;
}

/**
 * Spell slot tracking by level
 */
export interface SpellSlots {
  /** Spell slots by level (1-9) */
  [level: number]: {
    current: number;
    max: number;
  };
}

/**
 * Mutable Character State
 * Represents the current state of a character during gameplay
 */
export interface CharacterState {
  /** Character ID reference */
  characterId: string;

  // === Hit Points ===
  /** Current hit points */
  currentHP: number;
  /** Maximum hit points */
  maxHP: number;
  /** Temporary hit points (separate pool, consumed first) */
  tempHP: number;

  // === Resources ===
  /** Tracked resources by ID (rage, bardic-inspiration, ki-points, etc.) */
  resources: Record<string, TrackedResource>;

  /** Spell slots by level (if spellcaster) */
  spellSlots: SpellSlots | null;

  // === Conditions ===
  /** Active conditions affecting the character */
  conditions: ActiveCondition[];

  // === Concentration ===
  /** Concentration state (spellcasters only, max 1 concurrent) */
  concentration: ConcentrationState;

  // === Action Economy ===
  /** Current turn's action economy */
  actionEconomy: ActionEconomy;

  // === Death Saves ===
  /** Death save successes (0-3) */
  deathSaveSuccesses: number;
  /** Death save failures (0-3) */
  deathSaveFailures: number;

  // === Other State ===
  /** Current initiative value (if in combat) */
  initiative: number | null;
  /** Exhaustion level (0-6 in 2014, 0-10 in 2024) */
  exhaustionLevel: number;
  /** Has inspiration (2014) or heroic inspiration (2024) */
  hasInspiration: boolean;
}

/**
 * Result of a state update operation
 */
export interface StateUpdateResult {
  /** Updated state */
  state: CharacterState;
  /** Success flag */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Additional context about what changed */
  changes?: string[];
}

/**
 * Resource consumption error
 */
export interface ResourceError {
  /** Resource ID that failed */
  resourceId: string;
  /** Current value */
  current: number;
  /** Maximum value */
  max: number;
  /** Amount attempted */
  attempted: number;
  /** Error message */
  message: string;
}
