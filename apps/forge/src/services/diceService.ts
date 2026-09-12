 
// Dice roll types and utilities for NexusForge

export interface DiceRoll {
  id: string;
  type: 'ability' | 'skill' | 'initiative' | 'complex' | 'attack' | 'saving-throw';
  label: string;           // "STR Check" or "Acrobatics"
  notation: string;        // "1d20+3"
  diceResults: number[];   // [15]
  modifier: number;        // 3
  total: number;          // 18
  critical?: 'success' | 'failure';
  timestamp: number;
  // New fields for complex rolls
  pools?: Array<{ count: number; sides: number; results: number[] }>;
  expression?: string;
}

/**
 * Generate a unique ID (polyfill for crypto.randomUUID)
 * @returns UUID v4 string
 */
export function generateUUID(): string {
  // Try native crypto.randomUUID first
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback: Generate UUID v4 manually
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Roll dice with specified count and sides
 * @param count Number of dice to roll
 * @param sides Number of sides on each die
 * @returns Array of individual dice results
 */
export function rollDice(count: number, sides: number): number[] {
  const results: number[] = [];
  for (let i = 0; i < count; i++) {
    results.push(Math.floor(Math.random() * sides) + 1);
  }
  return results;
}

/**
 * Calculate D&D 5e ability modifier from ability score
 * @param score Ability score (1-30)
 * @returns Modifier (-5 to +10)
 */
export function calculateModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Detect if a roll is a critical success or failure
 * Only applies to d20 rolls
 * @param value The die value
 * @param sides The number of sides on the die
 * @returns 'success' for nat 20, 'failure' for nat 1, undefined otherwise
 */
export function detectCritical(
  value: number,
  sides: number
): 'success' | 'failure' | undefined {
  if (sides !== 20) return undefined;
  if (value === 20) return 'success';
  if (value === 1) return 'failure';
  return undefined;
}

/**
 * Create a dice roll for an ability check
 * @param abilityName The ability being checked (STR, DEX, etc.)
 * @param abilityScore The ability score
 * @returns DiceRoll object
 */
export function createAbilityRoll(
  abilityName: string,
  abilityScore: number
): DiceRoll {
  const modifier = calculateModifier(abilityScore);

  return {
    id: generateUUID(),
    type: 'ability',
    label: `${abilityName} Check`,
    notation: modifier === 0 ? '1d20' : `1d20${modifier >= 0 ? '+' : ''}${modifier}`,
    diceResults: [], // Will be filled by DiceBox results
    modifier,
    total: modifier, // Will be updated with actual total
    timestamp: Date.now(),
  };
}

/**
 * Create a dice roll for a skill check
 * @param skillName The skill being checked
 * @param skillValue The total skill modifier (ability + proficiency if applicable)
 * @returns DiceRoll object
 */
export function createSkillRoll(
  skillName: string,
  skillValue: number
): DiceRoll {
  return {
    id: generateUUID(),
    type: 'skill',
    label: skillName,
    notation: skillValue === 0 ? '1d20' : `1d20${skillValue >= 0 ? '+' : ''}${skillValue}`,
    diceResults: [], // Will be filled by DiceBox results
    modifier: skillValue,
    total: skillValue, // Will be updated with actual total
    timestamp: Date.now(),
  };
}

/**
 * Create a dice roll for initiative
 * @param initiativeModifier The initiative modifier
 * @returns DiceRoll object
 */
export function createInitiativeRoll(initiativeModifier: number): DiceRoll {
  return {
    id: generateUUID(),
    type: 'initiative',
    label: 'Initiative',
    notation: initiativeModifier === 0 ? '1d20' : `1d20${initiativeModifier >= 0 ? '+' : ''}${initiativeModifier}`,
    diceResults: [], // Will be filled by DiceBox results
    modifier: initiativeModifier,
    total: initiativeModifier, // Will be updated with actual total
    timestamp: Date.now(),
  };
}

/**
 * Format a dice roll for display
 * @param roll The dice roll to format
 * @returns Formatted string
 */
export function formatDiceRoll(roll: DiceRoll): string {
  const criticalClass = roll.critical === 'success'
    ? 'text-accent-green-light font-bold'
    : roll.critical === 'failure'
    ? 'text-accent-red-light font-bold'
    : '';

  return `<span class="${criticalClass}">${roll.label}: ${roll.notation} → ${roll.total}</span>`;
}

/**
 * Get roll history from localStorage
 * @returns Array of dice rolls (max 10)
 */
export function getRollHistory(): DiceRoll[] {
  try {
    const stored = localStorage.getItem('5e-forge-rolls');
    if (!stored) return [];
    return JSON.parse(stored);
   } catch {
     return [];
   }
}

/**
 * Save roll history to localStorage
 * @param rolls Array of dice rolls to save
 */
export function saveRollHistory(rolls: DiceRoll[]): void {
  try {
    // Keep only last 10 rolls
    const trimmed = rolls.slice(-10);
    localStorage.setItem('5e-forge-rolls', JSON.stringify(trimmed));
   } catch {
     // Error saving roll history
   }
}

/**
 * Add a roll to history
 * @param roll The roll to add
 * @returns Updated roll history
 */
export function addRollToHistory(roll: DiceRoll): DiceRoll[] {
  const history = getRollHistory();
  history.push(roll);
  const updated = history.slice(-10); // Keep last 10
  saveRollHistory(updated);
  return updated;
}

/**
 * Clear roll history
 */
export function clearRollHistory(): void {
  localStorage.removeItem('5e-forge-rolls');
}

/**
 * Create an advantage roll (2d20, keep highest)
 * @param label The roll label
 * @param modifier The modifier to add
 * @returns DiceRoll object
 */
export function createAdvantageRoll(label: string, modifier: number): DiceRoll {
  return {
    id: generateUUID(),
    type: 'complex',
    label: `${label} (Advantage)`,
    notation: modifier === 0 ? '2d20kh1' : `2d20kh1${modifier >= 0 ? '+' : ''}${modifier}`,
    diceResults: [], // Will be filled by DiceBox results (kept dice)
    modifier,
    total: modifier, // Will be updated with actual total
    timestamp: Date.now(),
    pools: [{
      count: 2,
      sides: 20,
      results: [] // Will be filled by DiceBox results (all dice)
    }],
    expression: modifier === 0 ? '2d20kh1' : `2d20kh1${modifier >= 0 ? '+' : ''}${modifier}`
  };
}

/**
 * Create a disadvantage roll (2d20, keep lowest)
 * @param label The roll label
 * @param modifier The modifier to add
 * @returns DiceRoll object
 */
export function createDisadvantageRoll(label: string, modifier: number): DiceRoll {
  return {
    id: generateUUID(),
    type: 'complex',
    label: `${label} (Disadvantage)`,
    notation: modifier === 0 ? '2d20kl1' : `2d20kl1${modifier >= 0 ? '+' : ''}${modifier}`,
    diceResults: [], // Will be filled by DiceBox results (kept dice)
    modifier,
    total: modifier, // Will be updated with actual total
    timestamp: Date.now(),
    pools: [{
      count: 2,
      sides: 20,
      results: [] // Will be filled by DiceBox results (all dice)
    }],
    expression: modifier === 0 ? '2d20kl1' : `2d20kl1${modifier >= 0 ? '+' : ''}${modifier}`
  };
}

/**
 * Create a complex dice roll with custom notation
 * @param label The roll label
 * @param notation The dice notation (e.g., "3d6+2", "2d20kh1", "4d6dl1")
 * @returns DiceRoll object
 */
export function createComplexRoll(label: string, notation: string): DiceRoll {
  // Parse simple notations for now (can be enhanced with the parser later)
  const match = notation.match(/^(\d+)d(\d+)(kh|kl)?(\d+)?([+-]\d+)?$/);
  if (!match) {
    throw new Error(`Invalid dice notation: ${notation}`);
  }

  const [, countStr, sidesStr, keepType, keepCountStr, modifierStr] = match;
  const count = parseInt(countStr);
  const sides = parseInt(sidesStr);
  const keepCount = keepCountStr ? parseInt(keepCountStr) : 1;
  const modifier = modifierStr ? parseInt(modifierStr) : 0;

  const diceResults = rollDice(count, sides);
  let keptResults = diceResults;

  // Handle keep highest/lowest
  if (keepType) {
    if (keepType === 'kh') {
      keptResults = diceResults.sort((a, b) => b - a).slice(0, keepCount);
    } else if (keepType === 'kl') {
      keptResults = diceResults.sort((a, b) => a - b).slice(0, keepCount);
    }
  }

  const total = keptResults.reduce((sum, val) => sum + val, 0) + modifier;

  return {
    id: generateUUID(),
    type: 'complex',
    label,
    notation,
    diceResults: keptResults,
    modifier,
    total,
    timestamp: Date.now(),
    pools: [{
      count,
      sides,
      results: diceResults
    }],
    expression: notation
  };
}

/**
 * Create a dice roll for a saving throw
 * @param abilityName The ability used for the save (STR, DEX, etc.)
 * @param abilityModifier The ability modifier
 * @param proficiencyBonus The character's proficiency bonus
 * @param isProficient Whether the character is proficient in this save
 * @returns DiceRoll object
 */
export function createSavingThrowRoll(
  abilityName: string,
  abilityModifier: number,
  proficiencyBonus: number,
  isProficient: boolean
): DiceRoll {
  const modifier = abilityModifier + (isProficient ? proficiencyBonus : 0);

  return {
    id: generateUUID(),
    type: 'saving-throw',
    label: `${abilityName} Save`,
    notation: modifier === 0 ? '1d20' : `1d20${modifier >= 0 ? '+' : ''}${modifier}`,
    diceResults: [], // Will be filled by DiceBox results
    modifier,
    total: modifier, // Will be updated with actual total
    timestamp: Date.now(),
  };
}

/**
 * Create a dice roll for a weapon attack
 * @param weaponName The name of the weapon
 * @param abilityModifier The relevant ability modifier (STR or DEX)
 * @param proficiencyBonus The character's proficiency bonus
 * @returns DiceRoll object
 */
export function createWeaponAttackRoll(
  weaponName: string,
  abilityModifier: number,
  proficiencyBonus: number
): DiceRoll {
  const modifier = abilityModifier + proficiencyBonus;

  return {
    id: generateUUID(),
    type: 'attack',
    label: `${weaponName} Attack`,
    notation: modifier === 0 ? '1d20' : `1d20${modifier >= 0 ? '+' : ''}${modifier}`,
    diceResults: [], // Will be filled by DiceBox results
    modifier,
    total: modifier, // Will be updated with actual total
    timestamp: Date.now(),
  };
}

/**
 * Create a dice roll for weapon damage
 * @param weaponName The name of the weapon
 * @param damageDice The damage dice notation (e.g., "1d8", "2d6")
 * @param abilityModifier The relevant ability modifier
 * @param damageType The type of damage (e.g., "slashing", "piercing")
 * @returns DiceRoll object
 */
export function createWeaponDamageRoll(
  weaponName: string,
  damageDice: string,
  abilityModifier: number,
  damageType: string
): DiceRoll {
  // Parse damage dice (e.g., "2d6" -> count=2, sides=6)
  const match = damageDice.match(/^(\d+)d(\d+)$/);
  if (!match) {
    throw new Error(`Invalid damage dice: ${damageDice}`);
  }

  const count = parseInt(match[1]);
  const sides = parseInt(match[2]);
  const diceResults = rollDice(count, sides);
  const diceTotal = diceResults.reduce((sum, val) => sum + val, 0);
  const total = diceTotal + abilityModifier;

  return {
    id: generateUUID(),
    type: 'complex',
    label: `${weaponName} Damage (${damageType})`,
    notation: abilityModifier === 0 ? damageDice : `${damageDice}${abilityModifier >= 0 ? '+' : ''}${abilityModifier}`,
    diceResults,
    modifier: abilityModifier,
    total,
    timestamp: Date.now(),
    pools: [{
      count,
      sides,
      results: diceResults
    }],
    expression: abilityModifier === 0 ? damageDice : `${damageDice}${abilityModifier >= 0 ? '+' : ''}${abilityModifier}`
  };
}
