import { loadSpells, type AppSpell } from './dataService';
import type { DerivedClassMechanics } from './classMechanics';
import type { AbilityName, Edition } from '../types/dnd';

export interface CantripActionInput {
  edition: Edition;
  /** Total character level: cantrip damage scales at 5, 11 and 17. */
  characterLevel: number;
  slug: string;
  spellAttackBonus: number;
  spellSaveDC: number;
  cantripEffects?: DerivedClassMechanics['cantripEffects'];
}

export interface CantripAction {
  slug: string;
  name: string;
  kind: 'attack' | 'save' | 'none';
  attackBonus?: number;
  saveAbility?: AbilityName;
  saveDC?: number;
  /** Dice rolled for one hit or one failed save, e.g. "2d10". */
  dice?: string;
  /** Flat bonus added to every damage roll (for example Agonizing Blast). */
  damageBonus: number;
  /** "2d10", "1d10+3" - the roll to make for one hit. */
  damageNotation?: string;
  damageType?: string;
  /** Eldritch Blast style spells make this many separate attack rolls. */
  attacks: number;
  /** Base range text from the spell and the range after invocation bonuses. */
  range: string;
  rangeFeet?: number;
  pushFeet?: number;
  requiresHit?: boolean;
  targetSizeLimit?: 'Large';
  /** Human-readable riders the sheet should show next to the roll. */
  notes: string[];
}

const tiersReached = (level: number): number =>
  [5, 11, 17].filter((threshold) => level >= threshold).length;

const normalise = (text: string): string => text.replace(/\s+/g, ' ');

/** Parses one cantrip into an attack/damage description for the sheet. */
export function resolveCantripAction(
  input: CantripActionInput,
): CantripAction | undefined {
  const spell: AppSpell | undefined = loadSpells(input.edition).find(
    (entry) => entry.slug === input.slug && entry.level === 0,
  );
  if (!spell) return undefined;
  const text = normalise(
    `${spell.description} ${spell.atHigherLevels ?? ''} ${spell.cantripUpgrade ?? ''}`,
  );
  const effect = input.cantripEffects?.[spell.slug] ?? {};
  const tiers = tiersReached(input.characterLevel);

  const damageMatch = text.match(/(\d+)d(\d+)\s+([A-Za-z]+)\s+damage/i);
  const beams = /\b(?:two|three|four) beams?\b/i.test(text);
  const scalesDice = !beams && /damage increases/i.test(text);
  const baseCount = damageMatch ? Number(damageMatch[1]) : 0;
  const diceCount = baseCount + (scalesDice ? tiers : 0);
  const dice = damageMatch ? `${diceCount}d${damageMatch[2]}` : undefined;

  const saveMatch = text.match(
    /(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving throw/i,
  );
  const saveAbility = (spell.saveType ??
    (saveMatch
      ? (saveMatch[1].slice(0, 3).toUpperCase() as AbilityName)
      : undefined)) as AbilityName | undefined;
  const kind: CantripAction['kind'] = /spell attack/i.test(text)
    ? 'attack'
    : saveAbility
      ? 'save'
      : 'none';
  const damageBonus = effect.damageBonus ?? 0;
  const rangeMatch = spell.range.match(/(\d+)\s*feet/i);
  const baseFeet = rangeMatch ? Number(rangeMatch[1]) : undefined;
  const notes: string[] = [];
  if (effect.rangeBonus && baseFeet && baseFeet >= 10)
    notes.push(`Range increased by ${effect.rangeBonus} feet.`);
  if (effect.pushFeet)
    notes.push(
      `On a hit you may push a ${effect.targetSizeLimit ?? 'Large'} or smaller creature ${effect.pushFeet} feet away.`,
    );
  if (damageBonus)
    notes.push(
      `Adds ${damageBonus >= 0 ? '+' : ''}${damageBonus} to each damage roll.`,
    );

  return {
    slug: spell.slug,
    name: spell.name,
    kind,
    ...(kind === 'attack' ? { attackBonus: input.spellAttackBonus } : {}),
    ...(kind === 'save' ? { saveAbility, saveDC: input.spellSaveDC } : {}),
    ...(dice ? { dice } : {}),
    damageBonus,
    ...(dice
      ? {
          damageNotation: `${dice}${damageBonus ? `${damageBonus > 0 ? '+' : ''}${damageBonus}` : ''}`,
        }
      : {}),
    ...(damageMatch ? { damageType: damageMatch[3].toLowerCase() } : {}),
    attacks: beams ? 1 + tiers : 1,
    range: spell.range,
    ...(baseFeet !== undefined
      ? {
          rangeFeet:
            baseFeet >= 10 ? baseFeet + (effect.rangeBonus ?? 0) : baseFeet,
        }
      : {}),
    ...(effect.pushFeet ? { pushFeet: effect.pushFeet } : {}),
    ...(effect.requiresHit ? { requiresHit: true } : {}),
    ...(effect.targetSizeLimit
      ? { targetSizeLimit: effect.targetSizeLimit }
      : {}),
    notes,
  };
}
