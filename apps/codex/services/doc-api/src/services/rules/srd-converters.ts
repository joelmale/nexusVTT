/**
 * Converters from the bundled 5e-bits SRD JSON (packages/character-creator/
 * src/data) into @nexus/rules-contracts entity data. Used only by the SRD
 * import comparison script; they never run in the request path.
 *
 * Converters are deliberately literal: anything they cannot map is reported
 * as a warning rather than guessed, so the comparison report shows where the
 * bundled data and the contract disagree.
 */
import { DamageTypeSchema, type RulesEntityType, type Ruleset } from '@nexus/rules-contracts';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = Record<string, any>;

export interface ConvertedEntity {
  entityType: RulesEntityType;
  ruleset: Ruleset;
  slug: string;
  /** Identifier in the source data (index or name). */
  sourceId: string;
  data: Record<string, unknown>;
  warnings: string[];
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const lastUrlSegment = (url: string): string => url.split('/').filter(Boolean).pop() ?? '';
const feet = (value: unknown): number | undefined => {
  const match = /(\d+)/.exec(String(value ?? ''));
  return match ? Number(match[1]) : undefined;
};
const compact = <T extends Record<string, unknown>>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;

// -- spells --------------------------------------------------------------

function castingTimeFrom(text: string, warnings: string[]): Record<string, unknown> {
  const normalized = text.trim().toLowerCase();
  const match = /^(\d+)\s+(action|bonus action|reaction|minutes?|hours?)$/.exec(normalized);
  if (!match) {
    warnings.push(`casting time "${text}" mapped to special`);
    return { unit: 'special', amount: 1, text };
  }
  const unit = match[2].replace(/s$/, '').replace(' ', '_');
  return { unit, amount: Number(match[1]) };
}

function rangeFrom(text: string, area: Raw | undefined): Record<string, unknown> {
  const normalized = text.trim().toLowerCase();
  const distance = /^(\d+)\s+(feet|foot|miles?)$/.exec(normalized);
  const range: Record<string, unknown> = distance
    ? {
        kind: 'distance',
        distance: { value: Number(distance[1]), unit: distance[2].startsWith('mile') ? 'miles' : 'feet' },
      }
    : { kind: ['self', 'touch', 'sight', 'unlimited', 'special'].includes(normalized) ? normalized : 'special' };
  if (area?.type && area?.size) range.area = { shape: String(area.type).toLowerCase(), size: area.size };
  return range;
}

function durationFrom(text: string, warnings: string[]): Record<string, unknown> {
  const normalized = text.trim().toLowerCase();
  if (normalized === 'instantaneous') return { kind: 'instantaneous' };
  if (normalized === 'special') return { kind: 'special' };
  if (normalized.startsWith('until dispelled or triggered')) return { kind: 'until_dispelled_or_triggered' };
  if (normalized.startsWith('until dispelled')) return { kind: 'until_dispelled' };
  const timed = /^(?:up to )?(\d+)\s+(round|minute|hour|day)s?$/.exec(normalized);
  if (timed) return { kind: 'timed', amount: Number(timed[1]), unit: timed[2] };
  warnings.push(`duration "${text}" mapped to special`);
  return { kind: 'special' };
}

function componentsFrom(components: string[], material: string | undefined): Record<string, unknown> {
  const set = new Set(components.map((c) => c.toLowerCase()));
  const hasMaterial = set.has('m');
  const cost = material
    ? /([\d,]+)\+?\s*(gp|sp|cp|gold pieces?|silver pieces?|copper pieces?)\b/i.exec(material)
    : null;
  const perGp: Record<string, number> = { g: 1, s: 0.1, c: 0.01 };
  const costGp = cost ? Number(cost[1].replace(/,/g, '')) * perGp[cost[2][0].toLowerCase()] : undefined;
  return compact({
    verbal: set.has('v'),
    somatic: set.has('s'),
    material: hasMaterial,
    materialText: hasMaterial ? material?.trim() || undefined : undefined,
    materialCostGp: hasMaterial && costGp !== undefined ? Math.round(costGp * 100) / 100 : undefined,
    materialConsumed: hasMaterial && material && /consume/i.test(material) ? true : undefined,
  });
}

export function convertSpell2014(raw: Raw): ConvertedEntity {
  const warnings: string[] = [];
  const higher = Array.isArray(raw.higher_level) && raw.higher_level.length > 0 ? raw.higher_level.join('\n\n') : undefined;
  return {
    entityType: 'spell',
    ruleset: '2014',
    slug: raw.index,
    sourceId: raw.index,
    warnings,
    data: compact({
      ruleset: '2014',
      name: raw.name,
      level: raw.level,
      school: raw.school?.index,
      castingTime: castingTimeFrom(raw.casting_time ?? '', warnings),
      range: rangeFrom(raw.range ?? '', raw.area_of_effect),
      components: componentsFrom(raw.components ?? [], raw.material),
      duration: durationFrom(raw.duration ?? '', warnings),
      concentration: Boolean(raw.concentration),
      ritual: Boolean(raw.ritual),
      classes: (raw.classes ?? []).map((c: Raw) => c.index),
      description: (raw.desc ?? []).join('\n\n'),
      higherLevel: higher,
    }),
  };
}

export function convertSpell2024(raw: Raw): ConvertedEntity {
  const warnings: string[] = [];
  const unitByAction: Record<string, string> = { action: 'action', bonusAction: 'bonus_action', reaction: 'reaction' };
  const castingTime = raw.castingTime
    ? castingTimeFrom(raw.castingTime, warnings)
    : compact({
        unit: unitByAction[raw.actionType] ?? 'special',
        amount: 1,
        trigger: raw.castingTrigger?.trim() || undefined,
      });
  if (!raw.castingTime && !unitByAction[raw.actionType]) warnings.push(`actionType "${raw.actionType}" unknown`);
  return {
    entityType: 'spell',
    ruleset: '2024',
    slug: slugify(raw.name),
    sourceId: raw.name,
    warnings,
    data: compact({
      ruleset: '2024',
      name: raw.name,
      level: raw.level,
      school: String(raw.school ?? '').toLowerCase(),
      castingTime,
      range: rangeFrom(raw.range ?? '', undefined),
      components: componentsFrom(raw.components ?? [], raw.material),
      duration: durationFrom(raw.duration ?? '', warnings),
      concentration: Boolean(raw.concentration),
      ritual: Boolean(raw.ritual),
      classes: (raw.classes ?? []).map((c: string) => slugify(c)),
      description: raw.description,
      higherLevel: raw.higherLevelSlot ?? raw.cantripUpgrade,
    }),
  };
}

// -- items ---------------------------------------------------------------

const TOOL_CATEGORIES = ['artisans-tools', 'tools', 'gaming-sets', 'musical-instruments', 'other-tools'];
const FOCUS_CATEGORIES = ['arcane-foci', 'druidic-foci', 'holy-symbols'];

function itemCategory(categories: Set<string>): string {
  if (categories.has('weapons')) return 'weapon';
  if (categories.has('shields')) return 'shield';
  if (categories.has('armor')) return 'armor';
  if (categories.has('ammunition')) return 'ammunition';
  if (TOOL_CATEGORIES.some((c) => categories.has(c))) return 'tool';
  if (FOCUS_CATEGORIES.some((c) => categories.has(c))) return 'spellcasting_focus';
  if (categories.has('equipment-packs')) return 'equipment_pack';
  if (categories.has('mounts-and-vehicles')) return 'mount_vehicle';
  if (categories.has('adventuring-gear')) return 'adventuring_gear';
  return 'other';
}

const damageRoll = (raw: Raw | undefined) =>
  raw?.damage_dice && raw?.damage_type
    ? { dice: String(raw.damage_dice).replace(/\s+/g, ''), type: raw.damage_type.index }
    : undefined;

export function convertItem2024(raw: Raw): ConvertedEntity {
  const warnings: string[] = [];
  const categories = new Set<string>(
    (raw.equipment_categories ?? []).map((c: Raw | undefined) => c?.index).filter(Boolean),
  );
  const category = itemCategory(categories);
  const properties: string[] = (raw.properties ?? []).map((p: Raw) => String(p.index).replace(/-/g, '_'));
  let weapon: Record<string, unknown> | undefined;
  if (category === 'weapon') {
    const ranged = categories.has('ranged-weapons');
    const rangeSource = ranged ? raw.range : properties.includes('thrown') ? raw.throw_range : undefined;
    weapon = compact({
      category: categories.has('martial-weapons') ? 'martial' : 'simple',
      kind: ranged ? 'ranged' : 'melee',
      damage: damageRoll(raw.damage),
      versatileDamage: properties.includes('versatile') ? damageRoll(raw.two_handed_damage) : undefined,
      properties,
      range: rangeSource?.normal ? compact({ normal: rangeSource.normal, long: rangeSource.long }) : undefined,
      mastery: raw.mastery?.index,
    });
  }
  let armor: Record<string, unknown> | undefined;
  if (category === 'armor' || category === 'shield') {
    const weight = ['light', 'medium', 'heavy'].find((w) => categories.has(`${w}-armor`));
    armor = compact({
      category: category === 'shield' ? 'shield' : weight,
      baseAc: raw.armor_class?.base,
      dexBonus: Boolean(raw.armor_class?.dex_bonus),
      maxDexBonus: raw.armor_class?.dex_bonus ? raw.armor_class?.max_bonus : undefined,
      strengthRequirement: raw.str_minimum > 0 ? raw.str_minimum : undefined,
      stealthDisadvantage: Boolean(raw.stealth_disadvantage),
      donTime: raw.don_time,
      doffTime: raw.doff_time,
    });
  }
  if (!raw.index) warnings.push('source has no index; slug derived from name');
  return {
    entityType: 'item',
    ruleset: '2024',
    slug: raw.index ?? slugify(String(raw.name ?? '')),
    sourceId: raw.index ?? raw.name,
    warnings,
    data: compact({
      ruleset: '2024',
      name: raw.name,
      category,
      rarity: 'mundane',
      attunement: { required: false },
      cost: raw.cost ? { amount: raw.cost.quantity, unit: raw.cost.unit } : undefined,
      weight: typeof raw.weight === 'number' ? raw.weight : undefined,
      weapon,
      armor,
      text: typeof raw.description === 'string' ? raw.description : '',
    }),
  };
}

// -- monsters ------------------------------------------------------------

const DAMAGE_TYPES = DamageTypeSchema.options;

/** "bludgeoning, piercing, and slashing from nonmagical attacks" -> three entries. */
export function parseDamageDefenses(entries: string[], warnings: string[]): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = [];
  for (const entry of entries) {
    const text = entry.toLowerCase();
    const found: Array<{ type: string; end: number }> = [];
    for (const type of DAMAGE_TYPES) {
      const match = new RegExp(`\\b${type}\\b`).exec(text);
      if (match) found.push({ type, end: match.index + type.length });
    }
    if (found.length === 0) {
      warnings.push(`damage defense "${entry}" has no damage type`);
      continue;
    }
    const lastEnd = Math.max(...found.map((f) => f.end));
    const qualifier = entry.slice(lastEnd).replace(/^[\s,]*(damage\s*)?/i, '').trim();
    for (const { type } of found) result.push(compact({ type, qualifier: qualifier || undefined }));
  }
  return result;
}

function usageFrom(raw: Raw | undefined): Record<string, unknown> | undefined {
  if (!raw?.type) return undefined;
  switch (raw.type) {
    case 'per day':
      return { type: 'per_day', times: raw.times };
    case 'recharge on roll':
      return { type: 'recharge', rechargeOn: raw.min_value };
    case 'recharge after rest':
      return { type: 'recharge_after_rest', rest: (raw.rest_types ?? []).includes('short') ? 'short' : 'long' };
    default:
      return undefined;
  }
}

function featureFrom(raw: Raw): Record<string, unknown> {
  const damage = (raw.damage ?? []).map(damageRoll).filter(Boolean);
  return compact({
    name: raw.name,
    description: raw.desc,
    attackBonus: raw.attack_bonus,
    saveDc: raw.dc?.dc_value,
    saveAbility: raw.dc?.dc_type?.index,
    damage: damage.length > 0 ? damage : undefined,
    usage: usageFrom(raw.usage),
  });
}

function spellFrequency(spell: Raw): string {
  if (spell.usage?.type === 'at will') return 'at will';
  if (spell.usage?.type === 'per day') return `${spell.usage.times}/day`;
  return spell.level === 0 ? 'cantrip' : `level ${spell.level}`;
}

export function convertMonster2014(raw: Raw): ConvertedEntity {
  const warnings: string[] = [];
  const swarm = /^swarm of (\w+) (\w+?)s?$/i.exec(raw.type ?? '');
  const savingThrows: Record<string, number> = {};
  const skills: Record<string, number> = {};
  for (const proficiency of raw.proficiencies ?? []) {
    const index: string = proficiency.proficiency?.index ?? '';
    if (index.startsWith('saving-throw-')) savingThrows[index.slice('saving-throw-'.length)] = proficiency.value;
    else if (index.startsWith('skill-')) skills[index.slice('skill-'.length).replace(/-/g, '_')] = proficiency.value;
    else warnings.push(`proficiency "${index}" ignored`);
  }
  const senses: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw.senses ?? {})) {
    if (key === 'passive_perception') senses.passivePerception = value;
    else senses[key] = feet(value);
  }
  const speed: Record<string, unknown> = { walk: 0 };
  for (const [key, value] of Object.entries(raw.speed ?? {})) {
    speed[key] = key === 'hover' ? Boolean(value) : feet(value);
  }
  const spellcasting = (raw.special_abilities ?? [])
    .filter((ability: Raw) => ability.spellcasting)
    .map((ability: Raw) =>
      compact({
        name: ability.name,
        ability: ability.spellcasting.ability?.index,
        saveDc: ability.spellcasting.dc,
        attackBonus: ability.spellcasting.modifier,
        description: ability.desc,
        spells: (ability.spellcasting.spells ?? []).map((spell: Raw) => ({
          ref: lastUrlSegment(spell.url ?? '') || slugify(spell.name ?? ''),
          frequency: spellFrequency(spell),
        })),
      }),
    );
  const legendary = (raw.legendary_actions ?? []).map((action: Raw) => ({
    name: action.name,
    description: action.desc,
    cost: Number(/costs (\d) actions/i.exec(action.name ?? '')?.[1] ?? 1),
  }));
  const armorClass = (raw.armor_class ?? []).map((ac: Raw) => {
    const source =
      ac.type === 'natural'
        ? 'natural armor'
        : ac.type === 'armor'
          ? (ac.armor ?? []).map((a: Raw) => a.name.toLowerCase()).join(', ') || undefined
          : ac.type === 'spell'
            ? ac.spell?.name?.toLowerCase()
            : undefined;
    return compact({ value: ac.value, source, condition: ac.condition ? `while ${ac.condition.name.toLowerCase()}` : undefined });
  });
  const languages = String(raw.languages ?? '')
    .split(/,\s*/)
    .map((l) => l.trim())
    .filter((l) => l && l !== '-' && l !== '—');
  return {
    entityType: 'monster',
    ruleset: '2014',
    slug: raw.index,
    sourceId: raw.index,
    warnings,
    data: compact({
      ruleset: '2014',
      name: raw.name,
      size: String(raw.size ?? '').toLowerCase(),
      type: swarm ? swarm[2].toLowerCase() : raw.type,
      subtype: raw.subtype || undefined,
      swarmOf: swarm ? swarm[1].toLowerCase() : undefined,
      alignment: raw.alignment,
      armorClass,
      hitPoints: { average: raw.hit_points, formula: String(raw.hit_points_roll ?? '').replace(/\s+/g, '') },
      speed,
      abilityScores: {
        str: raw.strength,
        dex: raw.dexterity,
        con: raw.constitution,
        int: raw.intelligence,
        wis: raw.wisdom,
        cha: raw.charisma,
      },
      savingThrows,
      skills,
      damageVulnerabilities: parseDamageDefenses(raw.damage_vulnerabilities ?? [], warnings),
      damageResistances: parseDamageDefenses(raw.damage_resistances ?? [], warnings),
      damageImmunities: parseDamageDefenses(raw.damage_immunities ?? [], warnings),
      conditionImmunities: (raw.condition_immunities ?? []).map((c: Raw) => c.index),
      senses,
      languages,
      challengeRating: raw.challenge_rating,
      xp: raw.xp,
      proficiencyBonus: raw.proficiency_bonus,
      traits: (raw.special_abilities ?? []).filter((a: Raw) => !a.spellcasting).map(featureFrom),
      actions: (raw.actions ?? []).map(featureFrom),
      reactions: (raw.reactions ?? []).map(featureFrom),
      legendaryActions: legendary.length > 0 ? { usesPerRound: 3, actions: legendary } : undefined,
      spellcasting: spellcasting.length > 0 ? spellcasting : undefined,
    }),
  };
}
