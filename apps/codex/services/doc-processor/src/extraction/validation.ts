import { MonsterParser } from '../parsers/monster-parser';
import { SpellParser } from '../parsers/spell-parser';
import { ItemParser } from '../parsers/item-parser';
import { EntityType, ExtractedEntity, Item, Monster, Spell } from './schemas';

/**
 * Cross-checks for model output (plan: Extraction step 3). Each failed check
 * adds a review reason; any reason puts the entity in needs_review. Wrong and
 * unflagged is the worst outcome, so checks lean towards flagging.
 */

export type Review = {
  status: 'auto' | 'needs_review';
  confidence: number;
  reasons: string[];
  baseline: 'agrees' | 'disagrees' | 'not_found';
};

export const REVIEW_CONFIDENCE_THRESHOLD = 0.6;

export const SPELL_SCHOOLS = new Set([
  'abjuration', 'conjuration', 'divination', 'enchantment', 'evocation', 'illusion', 'necromancy', 'transmutation',
]);
export const ITEM_RARITIES = new Set(['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact', 'varies', 'rarity varies']);
export const ITEM_TYPES = [
  'armor', 'shield', 'potion', 'ring', 'rod', 'scroll', 'staff', 'wand', 'weapon', 'wondrous item', 'ammunition',
];

// DMG/MM challenge rating -> XP.
export const CR_XP: Record<string, number> = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800, '6': 2300,
  '7': 2900, '8': 3900, '9': 5000, '10': 5900, '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000,
  '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000, '21': 33000, '22': 41000, '23': 50000,
  '24': 62000, '25': 75000, '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000,
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const modifier = (score: number) => Math.floor((score - 10) / 2);
const MINUS = /[−–]/g;

/** Every integer written in the source region, e.g. "114 (12d10 + 48)" -> 114, 12, 10, 48. */
export const sourceNumbers = (text: string) =>
  new Set((text.replace(/,(?=\d{3})/g, '').match(/\d+/g) || []).map(Number));

const grounding = (type: EntityType, entity: ExtractedEntity, source: string): string[] => {
  const numbers = sourceNumbers(source);
  const values: Array<[string, number]> = [];
  if (type === 'monster') {
    const m = entity as Monster;
    values.push(['armorClass', m.armorClass], ['hitPoints', m.hitPoints]);
    for (const [ability, score] of Object.entries(m.abilities)) values.push([`abilities.${ability}`, score]);
    const dcs = [...m.actions, ...m.traits, ...(m.legendaryActions || [])]
      .flatMap((a) => [...a.description.matchAll(/\bDC\s*(\d+)/gi)].map((match) => Number(match[1])));
    dcs.forEach((dc) => values.push(['saveDC', dc]));
  } else if (type === 'spell') {
    const s = entity as Spell;
    if (s.level > 0) values.push(['level', s.level]); // cantrips print no number
    const dcs = [...s.description.matchAll(/\bDC\s*(\d+)/gi)].map((match) => Number(match[1]));
    dcs.forEach((dc) => values.push(['saveDC', dc]));
  }
  return values.filter(([, value]) => !numbers.has(value)).map(([field, value]) => `ungrounded:${field}=${value}`);
};

const monsterConsistency = (m: Monster, source: string): string[] => {
  const reasons: string[] = [];

  // Printed modifiers must match printed scores ("18 (+4)"), and the extracted
  // score must be one of the printed ones.
  const printed = [...source.replace(MINUS, '-').matchAll(/\b(\d{1,2})\s*\(([+-]\d{1,2})\)/g)]
    .map((match) => ({ score: Number(match[1]), mod: Number(match[2]) }));
  if (printed.some((p) => modifier(p.score) !== p.mod)) reasons.push('ability_modifier_mismatch');

  const cr = m.challengeRating.trim().split(/\s+/)[0];
  const xpMatch = (m.challengeRating.match(/\(([\d,]+)\s*XP\)/i) || source.match(/challenge\s+[\d/]+\s*\(([\d,]+)\s*XP\)/i));
  if (!(cr in CR_XP)) {
    reasons.push(`unknown_cr:${cr}`);
  } else if (xpMatch && Number(xpMatch[1].replace(/,/g, '')) !== CR_XP[cr]) {
    reasons.push('xp_cr_mismatch');
  }

  if (m.hitDice) {
    const dice = m.hitDice.replace(MINUS, '-').match(/(\d+)d(\d+)\s*(?:([+-])\s*(\d+))?/);
    if (dice) {
      const [, count, size, sign, bonus] = dice;
      const average = Math.floor((Number(count) * (Number(size) + 1)) / 2) + (sign === '-' ? -1 : 1) * Number(bonus || 0);
      if (Math.abs(average - m.hitPoints) > 1) reasons.push(`hit_dice_average:${average}!=${m.hitPoints}`);
    }
  }

  if (Object.values(m.abilities).some((score) => score < 1 || score > 30)) reasons.push('ability_out_of_range');
  return reasons;
};

const spellConsistency = (s: Spell): string[] => {
  const reasons: string[] = [];
  if (s.level < 0 || s.level > 9) reasons.push(`spell_level_out_of_range:${s.level}`);
  if (!SPELL_SCHOOLS.has(s.school.toLowerCase().trim())) reasons.push(`unknown_school:${s.school}`);
  const letters = s.components.split('(')[0].split(/[,\s]+/).filter(Boolean).map((c) => c.toUpperCase());
  if (letters.length === 0 || letters.some((c) => !['V', 'S', 'M'].includes(c))) {
    reasons.push(`invalid_components:${s.components}`);
  }
  return reasons;
};

const itemConsistency = (i: Item): string[] => {
  const reasons: string[] = [];
  if (!ITEM_RARITIES.has(i.rarity.toLowerCase().trim())) reasons.push(`unknown_rarity:${i.rarity}`);
  const type = i.type.toLowerCase();
  if (!ITEM_TYPES.some((known) => type.startsWith(known))) reasons.push(`unknown_item_type:${i.type}`);
  return reasons;
};

const firstInt = (value?: string) => {
  const match = value?.match(/\d+/);
  return match ? Number(match[0]) : undefined;
};

/**
 * Baseline agreement: the v1 regex parsers run on the (now clean) candidate
 * text. Agreement raises confidence; a field-level disagreement is a review
 * reason. Not finding the entity is common for the regex parsers and is not
 * held against the model.
 */
export const baselineAgreement = (
  type: EntityType,
  entity: ExtractedEntity,
  source: string
): { result: Review['baseline']; reasons: string[] } => {
  const text = source.replace(/[#*_`>]/g, '').replace(/\n{2,}/g, '\n');
  const name = normalize(entity.name);
  const reasons: string[] = [];

  if (type === 'monster') {
    const found = new MonsterParser().parse(text).find((p) => normalize(p.entity.name) === name);
    if (!found) return { result: 'not_found', reasons };
    const m = entity as Monster;
    const ac = firstInt(found.entity.ac);
    const hp = firstInt(found.entity.hp);
    if (ac !== undefined && ac !== m.armorClass) reasons.push(`baseline_disagrees:armorClass=${ac}`);
    if (hp !== undefined && hp !== m.hitPoints) reasons.push(`baseline_disagrees:hitPoints=${hp}`);
  } else if (type === 'spell') {
    const found = new SpellParser().parse(text).find((p) => normalize(p.entity.name) === name);
    if (!found) return { result: 'not_found', reasons };
    const s = entity as Spell;
    const level = /cantrip/i.test(found.entity.level) ? 0 : firstInt(found.entity.level);
    if (level !== undefined && level !== s.level) reasons.push(`baseline_disagrees:level=${level}`);
    if (found.entity.school && normalize(found.entity.school) !== normalize(s.school)) {
      reasons.push(`baseline_disagrees:school=${found.entity.school}`);
    }
  } else {
    const found = new ItemParser().parse(text).find((p) => normalize(p.entity.name) === name);
    if (!found) return { result: 'not_found', reasons };
    const i = entity as Item;
    if (found.entity.rarity && normalize(found.entity.rarity) !== normalize(i.rarity)) {
      reasons.push(`baseline_disagrees:rarity=${found.entity.rarity}`);
    }
  }

  return { result: reasons.length ? 'disagrees' : 'agrees', reasons };
};

export const reviewEntity = (type: EntityType, entity: ExtractedEntity, source: string): Review => {
  const grounded = grounding(type, entity, source);
  const consistency = type === 'monster'
    ? monsterConsistency(entity as Monster, source)
    : type === 'spell'
      ? spellConsistency(entity as Spell)
      : itemConsistency(entity as Item);
  const baseline = baselineAgreement(type, entity, source);

  const reasons = [...grounded, ...consistency, ...baseline.reasons];
  let confidence = 0.85 - 0.3 * grounded.length - 0.2 * (consistency.length + baseline.reasons.length);
  if (baseline.result === 'agrees') confidence += 0.1;
  confidence = Math.round(Math.max(0, Math.min(1, confidence)) * 100) / 100;

  return {
    status: reasons.length === 0 && confidence >= REVIEW_CONFIDENCE_THRESHOLD ? 'auto' : 'needs_review',
    confidence,
    reasons,
    baseline: baseline.result,
  };
};
