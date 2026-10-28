/**
 * Converters from the bundled 5e-bits SRD JSON (packages/character-creator/
 * src/data) into @nexus/rules-contracts entity data. Used only by the SRD
 * import comparison script; they never run in the request path.
 *
 * Converters are deliberately literal: anything they cannot map is reported
 * as a warning rather than guessed, so the comparison report shows where the
 * bundled data and the contract disagree.
 */
import {
  DamageTypeSchema,
  type RulesEntityType,
  type Ruleset,
} from '@nexus/rules-contracts';

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

const lastUrlSegment = (url: string): string =>
  url.split('/').filter(Boolean).pop() ?? '';
const feet = (value: unknown): number | undefined => {
  const match = /(\d+)/.exec(String(value ?? ''));
  return match ? Number(match[1]) : undefined;
};
const compact = <T extends Record<string, unknown>>(value: T): T =>
  Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as T;

// -- spells --------------------------------------------------------------

function castingTimeFrom(
  text: string,
  warnings: string[],
): Record<string, unknown> {
  const normalized = text.trim().toLowerCase();
  const match = /^(\d+)\s+(action|bonus action|reaction|minutes?|hours?)$/.exec(
    normalized,
  );
  if (!match) {
    warnings.push(`casting time "${text}" mapped to special`);
    return { unit: 'special', amount: 1, text };
  }
  const unit = match[2].replace(/s$/, '').replace(' ', '_');
  return { unit, amount: Number(match[1]) };
}

function rangeFrom(
  text: string,
  area: Raw | undefined,
): Record<string, unknown> {
  const normalized = text.trim().toLowerCase();
  const distance = /^(\d+)\s+(feet|foot|miles?)$/.exec(normalized);
  const range: Record<string, unknown> = distance
    ? {
        kind: 'distance',
        distance: {
          value: Number(distance[1]),
          unit: distance[2].startsWith('mile') ? 'miles' : 'feet',
        },
      }
    : {
        kind: ['self', 'touch', 'sight', 'unlimited', 'special'].includes(
          normalized,
        )
          ? normalized
          : 'special',
      };
  if (area?.type && area?.size)
    range.area = { shape: String(area.type).toLowerCase(), size: area.size };
  return range;
}

function durationFrom(
  text: string,
  warnings: string[],
): Record<string, unknown> {
  const normalized = text.trim().toLowerCase();
  if (normalized === 'instantaneous') return { kind: 'instantaneous' };
  if (normalized === 'special') return { kind: 'special' };
  if (normalized.startsWith('until dispelled or triggered'))
    return { kind: 'until_dispelled_or_triggered' };
  if (normalized.startsWith('until dispelled'))
    return { kind: 'until_dispelled' };
  const timed = /^(?:up to )?(\d+)\s+(round|minute|hour|day)s?$/.exec(
    normalized,
  );
  if (timed) return { kind: 'timed', amount: Number(timed[1]), unit: timed[2] };
  warnings.push(`duration "${text}" mapped to special`);
  return { kind: 'special' };
}

function componentsFrom(
  components: string[],
  material: string | undefined,
): Record<string, unknown> {
  const set = new Set(components.map((c) => c.toLowerCase()));
  const hasMaterial = set.has('m');
  const cost = material
    ? /([\d,]+)\+?\s*(gp|sp|cp|gold pieces?|silver pieces?|copper pieces?)\b/i.exec(
        material,
      )
    : null;
  const perGp: Record<string, number> = { g: 1, s: 0.1, c: 0.01 };
  const costGp = cost
    ? Number(cost[1].replace(/,/g, '')) * perGp[cost[2][0].toLowerCase()]
    : undefined;
  return compact({
    verbal: set.has('v'),
    somatic: set.has('s'),
    material: hasMaterial,
    materialText: hasMaterial ? material?.trim() || undefined : undefined,
    materialCostGp:
      hasMaterial && costGp !== undefined
        ? Math.round(costGp * 100) / 100
        : undefined,
    materialConsumed:
      hasMaterial && material && /consume/i.test(material) ? true : undefined,
  });
}

export function convertSpell2014(raw: Raw): ConvertedEntity {
  const warnings: string[] = [];
  const higher =
    Array.isArray(raw.higher_level) && raw.higher_level.length > 0
      ? raw.higher_level.join('\n\n')
      : undefined;
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
  const unitByAction: Record<string, string> = {
    action: 'action',
    bonusAction: 'bonus_action',
    reaction: 'reaction',
  };
  const castingTime = raw.castingTime
    ? castingTimeFrom(raw.castingTime, warnings)
    : compact({
        unit: unitByAction[raw.actionType] ?? 'special',
        amount: 1,
        trigger: raw.castingTrigger?.trim() || undefined,
      });
  if (!raw.castingTime && !unitByAction[raw.actionType])
    warnings.push(`actionType "${raw.actionType}" unknown`);
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

const TOOL_CATEGORIES = [
  'artisans-tools',
  'tools',
  'gaming-sets',
  'musical-instruments',
  'other-tools',
];
const FOCUS_CATEGORIES = ['arcane-foci', 'druidic-foci', 'holy-symbols'];

function itemCategory(categories: Set<string>, name = ''): string {
  if (categories.has('weapons')) return 'weapon';
  if (categories.has('shields')) return 'shield';
  if (categories.has('armor')) return 'armor';
  if (categories.has('ammunition')) return 'ammunition';
  const lowerName = name.toLowerCase();
  if (lowerName.startsWith('potion') || lowerName.includes('potion of'))
    return 'potion';
  if (lowerName.startsWith('spell scroll') || lowerName.startsWith('scroll'))
    return 'scroll';
  if (TOOL_CATEGORIES.some((c) => categories.has(c))) return 'tool';
  if (FOCUS_CATEGORIES.some((c) => categories.has(c)))
    return 'spellcasting_focus';
  if (categories.has('equipment-packs')) return 'equipment_pack';
  if (categories.has('mounts-and-vehicles')) return 'mount_vehicle';
  if (categories.has('adventuring-gear')) return 'adventuring_gear';
  return 'other';
}

const damageRoll = (raw: Raw | undefined) =>
  raw?.damage_dice && raw?.damage_type
    ? {
        dice: String(raw.damage_dice).replace(/\s+/g, ''),
        type: raw.damage_type.index,
      }
    : undefined;

/**
 * SRD 5.2 lists most gear as structured fields only (no prose), so the catalog
 * text would be empty. This builds a factual one-paragraph summary from those
 * fields: a tool's ability, utilize checks and craftable items; a weapon's
 * damage, properties and mastery; an armor's AC and requirements.
 */
export function summarizeItem2024(raw: Raw): string {
  const parts: string[] = [];
  const names = (list: unknown): string[] =>
    Array.isArray(list)
      ? list.map((entry: Raw) => String(entry?.name ?? '')).filter(Boolean)
      : [];
  const ability = raw.ability?.name ?? raw.ability?.index;
  if (ability) parts.push(`Ability: ${String(ability).toUpperCase()}.`);
  if (Array.isArray(raw.utilize) && raw.utilize.length) {
    const actions = raw.utilize.map((entry: Raw) =>
      entry?.dc?.dc_value
        ? `${entry.name} (DC ${entry.dc.dc_value})`
        : String(entry?.name ?? ''),
    );
    parts.push(`Utilize: ${actions.filter(Boolean).join('; ')}.`);
  }
  const craft = names(raw.craft);
  if (craft.length) parts.push(`Craft: ${craft.join(', ')}.`);
  if (raw.damage?.damage_dice) {
    const type = raw.damage.damage_type?.name;
    const versatile = raw.two_handed_damage?.damage_dice
      ? ` (versatile ${raw.two_handed_damage.damage_dice})`
      : '';
    parts.push(
      `Damage: ${raw.damage.damage_dice}${type ? ` ${String(type).toLowerCase()}` : ''}${versatile}.`,
    );
  }
  const properties = names(raw.properties);
  if (properties.length) {
    const range = raw.throw_range ?? raw.range;
    const withRange = properties.map((name) =>
      name === 'Thrown' && raw.throw_range?.normal
        ? `Thrown (range ${raw.throw_range.normal}/${raw.throw_range.long ?? raw.throw_range.normal})`
        : name === 'Ammunition' && range?.normal
          ? `Ammunition (range ${range.normal}/${range.long ?? range.normal})`
          : name,
    );
    parts.push(`Properties: ${withRange.join(', ')}.`);
  }
  if (raw.mastery?.name) parts.push(`Weapon Mastery: ${raw.mastery.name}.`);
  if (raw.armor_class?.base !== undefined) {
    const max = raw.armor_class.max_bonus;
    const dex = raw.armor_class.dex_bonus
      ? ` + Dex modifier${max ? ` (max ${max})` : ''}`
      : '';
    parts.push(`Armor Class: ${raw.armor_class.base}${dex}.`);
  }
  if (raw.str_minimum > 0) parts.push(`Strength ${raw.str_minimum} required.`);
  if (raw.stealth_disadvantage) parts.push('Stealth: Disadvantage.');
  return parts.join(' ');
}

export function convertItem2024(raw: Raw): ConvertedEntity {
  const warnings: string[] = [];
  const categories = new Set<string>(
    (raw.equipment_categories ?? [])
      .map((c: Raw | undefined) => c?.index)
      .filter(Boolean),
  );
  const category = itemCategory(categories, String(raw.name ?? ''));
  const properties: string[] = (raw.properties ?? []).map((p: Raw) =>
    String(p.index).replace(/-/g, '_'),
  );
  let weapon: Record<string, unknown> | undefined;
  if (category === 'weapon') {
    const ranged = categories.has('ranged-weapons');
    const rangeSource = ranged
      ? raw.range
      : properties.includes('thrown')
        ? raw.throw_range
        : undefined;
    weapon = compact({
      category: categories.has('martial-weapons') ? 'martial' : 'simple',
      kind: ranged ? 'ranged' : 'melee',
      damage: damageRoll(raw.damage),
      versatileDamage: properties.includes('versatile')
        ? damageRoll(raw.two_handed_damage)
        : undefined,
      properties,
      range: rangeSource?.normal
        ? compact({ normal: rangeSource.normal, long: rangeSource.long })
        : undefined,
      mastery: raw.mastery?.index,
    });
  }
  let armor: Record<string, unknown> | undefined;
  if (category === 'armor' || category === 'shield') {
    const weight = ['light', 'medium', 'heavy'].find((w) =>
      categories.has(`${w}-armor`),
    );
    armor = compact({
      category: category === 'shield' ? 'shield' : weight,
      baseAc: raw.armor_class?.base,
      dexBonus: Boolean(raw.armor_class?.dex_bonus),
      maxDexBonus: raw.armor_class?.dex_bonus
        ? raw.armor_class?.max_bonus
        : undefined,
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
      cost: raw.cost
        ? { amount: raw.cost.quantity, unit: raw.cost.unit }
        : undefined,
      weight: typeof raw.weight === 'number' ? raw.weight : undefined,
      weapon,
      armor,
      text:
        typeof raw.description === 'string' && raw.description.trim()
          ? raw.description
          : summarizeItem2024(raw),
    }),
  };
}

export function convertItem2014(raw: Raw): ConvertedEntity {
  const warnings: string[] = [];
  const cat = raw.equipment_category?.index || '';
  let category = 'adventuring_gear';
  if (cat === 'weapon') {
    category = 'weapon';
  } else if (
    raw.armor_category === 'Shield' ||
    String(raw.name ?? '')
      .toLowerCase()
      .includes('shield')
  ) {
    category = 'shield';
  } else if (cat === 'armor') {
    category = 'armor';
  } else if (cat === 'ammunition') {
    category = 'ammunition';
  } else if (cat === 'tools') {
    category = 'tool';
  } else if (
    raw.gear_category?.index === 'holy-symbols' ||
    raw.gear_category?.index === 'arcane-foci' ||
    raw.gear_category?.index === 'druidic-foci'
  ) {
    category = 'spellcasting_focus';
  } else if (raw.gear_category?.index === 'equipment-packs') {
    category = 'equipment_pack';
  } else if (
    raw.gear_category?.index === 'mounts-and-vehicles' ||
    cat === 'mounts-and-vehicles'
  ) {
    category = 'mount_vehicle';
  }

  const cost = raw.cost
    ? { amount: raw.cost.quantity, unit: raw.cost.unit }
    : undefined;
  let text = '';
  if (Array.isArray(raw.desc)) text = raw.desc.join('\n\n');
  else if (typeof raw.desc === 'string') text = raw.desc;

  let weapon: Record<string, unknown> | undefined;
  if (category === 'weapon') {
    const isMartial = String(raw.weapon_category || '')
      .toLowerCase()
      .includes('martial');
    const isRanged = String(raw.weapon_range || '')
      .toLowerCase()
      .includes('ranged');
    const props = (raw.properties || []).map((p: Raw) =>
      (p.index || p.name || '').toLowerCase().replace(/-/g, '_'),
    );
    const uniqueProps = Array.from(
      new Set(
        props.filter((p: string) =>
          [
            'ammunition',
            'finesse',
            'heavy',
            'light',
            'loading',
            'range',
            'reach',
            'special',
            'thrown',
            'two_handed',
            'versatile',
          ].includes(p),
        ),
      ),
    );

    let damage = { dice: '1d4', type: 'bludgeoning' };
    if (raw.damage?.damage_dice && raw.damage?.damage_type?.index) {
      damage = {
        dice: String(raw.damage.damage_dice).replace(/\s+/g, ''),
        type: raw.damage.damage_type.index,
      };
    }

    let versatileDamage: Record<string, unknown> | undefined;
    if (uniqueProps.includes('versatile')) {
      if (
        raw['2h_damage']?.damage_dice &&
        raw['2h_damage']?.damage_type?.index
      ) {
        versatileDamage = {
          dice: String(raw['2h_damage'].damage_dice).replace(/\s+/g, ''),
          type: raw['2h_damage'].damage_type.index,
        };
      } else {
        versatileDamage = damage;
      }
    }

    let range: Record<string, unknown> | undefined;
    if (raw.range?.normal) {
      range = { normal: raw.range.normal, long: raw.range.long || undefined };
    } else if (isRanged || uniqueProps.includes('thrown')) {
      range = { normal: 20, long: 60 };
    }

    weapon = compact({
      category: isMartial ? 'martial' : 'simple',
      kind: isRanged ? 'ranged' : 'melee',
      damage,
      versatileDamage,
      properties: uniqueProps,
      range,
    });
  }

  let armor: Record<string, unknown> | undefined;
  if (category === 'armor' || category === 'shield') {
    let armorCat = String(raw.armor_category || '').toLowerCase();
    if (category === 'shield' || armorCat === 'shield') {
      armorCat = 'shield';
    } else if (!['light', 'medium', 'heavy', 'shield'].includes(armorCat)) {
      armorCat = 'medium';
    }

    armor = compact({
      category: armorCat,
      baseAc: raw.armor_class?.base || (armorCat === 'shield' ? 2 : 10),
      dexBonus:
        raw.armor_class?.dex_bonus ??
        (armorCat === 'light' || armorCat === 'medium'),
      maxDexBonus: raw.armor_class?.max_bonus ?? undefined,
      strengthRequirement: raw.str_minimum > 0 ? raw.str_minimum : undefined,
      stealthDisadvantage: Boolean(raw.stealth_disadvantage),
    });
  }

  const slug = raw.index || slugify(String(raw.name ?? ''));
  return {
    entityType: 'item',
    ruleset: '2014',
    slug,
    sourceId: raw.index ?? raw.name,
    warnings,
    data: compact({
      ruleset: '2014',
      name: raw.name,
      category,
      rarity: 'mundane',
      attunement: { required: false },
      cost,
      weight: typeof raw.weight === 'number' ? raw.weight : undefined,
      weapon,
      armor,
      text,
    }),
  };
}

export function convertMagicItem(raw: Raw, ruleset: Ruleset): ConvertedEntity {
  const warnings: string[] = [];
  const cat = raw.equipment_category?.index || 'wondrous-items';
  let category = 'wondrous';
  if (cat === 'potion') category = 'potion';
  else if (cat === 'ring') category = 'ring';
  else if (cat === 'rod') category = 'rod';
  else if (cat === 'scroll') category = 'scroll';
  else if (cat === 'staff') category = 'staff';
  else if (cat === 'wand') category = 'wand';
  else if (cat === 'ammunition') category = 'ammunition';
  else if (cat === 'weapon') category = 'weapon';
  else if (cat === 'armor') {
    category = String(raw.name ?? '')
      .toLowerCase()
      .includes('shield')
      ? 'shield'
      : 'armor';
  }

  let rawRarity = String(raw.rarity?.name || 'common')
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (
    ![
      'common',
      'uncommon',
      'rare',
      'very_rare',
      'legendary',
      'artifact',
      'varies',
    ].includes(rawRarity)
  ) {
    rawRarity = 'uncommon';
  }

  const text = Array.isArray(raw.desc)
    ? raw.desc.join('\n\n')
    : typeof raw.desc === 'string'
      ? raw.desc
      : '';
  const firstLine =
    Array.isArray(raw.desc) && raw.desc.length > 0 ? String(raw.desc[0]) : '';
  const attuneMatch =
    /requires attunement(?:\s+by\s+([^)]+))?/i.exec(firstLine) ||
    /requires attunement(?:\s+by\s+([^)]+))?/i.exec(text);

  const attunement = {
    required: Boolean(attuneMatch),
    requirement: attuneMatch?.[1] ? `by ${attuneMatch[1].trim()}` : undefined,
  };

  let weapon: Record<string, unknown> | undefined;
  if (category === 'weapon') {
    const lowerName = String(raw.name ?? '').toLowerCase();
    const isRanged =
      lowerName.includes('bow') ||
      lowerName.includes('sling') ||
      lowerName.includes('dart') ||
      lowerName.includes('javelin');
    const isDagger = lowerName.includes('dagger');
    const isSword =
      lowerName.includes('sword') ||
      lowerName.includes('blade') ||
      lowerName.includes('scimitar');
    const isAxe = lowerName.includes('axe');
    const isHammer = lowerName.includes('hammer');
    const isMace =
      lowerName.includes('mace') ||
      lowerName.includes('flail') ||
      lowerName.includes('morningstar');
    const isSpear =
      lowerName.includes('spear') ||
      lowerName.includes('trident') ||
      lowerName.includes('pike');

    let damage = { dice: '1d8', type: 'slashing' };
    let props: string[] = [];
    let versatileDamage: Record<string, unknown> | undefined;
    let range: Record<string, unknown> | undefined;
    const kind = isRanged ? 'ranged' : 'melee';

    if (isDagger) {
      damage = { dice: '1d4', type: 'piercing' };
      props = ['finesse', 'light', 'thrown'];
      range = { normal: 20, long: 60 };
    } else if (isRanged) {
      damage = { dice: '1d8', type: 'piercing' };
      props = ['range', 'two_handed'];
      range = { normal: 150, long: 600 };
    } else if (isSword || isAxe) {
      damage = { dice: '1d8', type: 'slashing' };
      props = ['versatile'];
      versatileDamage = { dice: '1d10', type: 'slashing' };
    } else if (isHammer || isMace) {
      damage = { dice: '1d8', type: 'bludgeoning' };
      props = ['versatile'];
      versatileDamage = { dice: '1d10', type: 'bludgeoning' };
    } else if (isSpear) {
      damage = { dice: '1d6', type: 'piercing' };
      props = ['thrown', 'versatile'];
      range = { normal: 20, long: 60 };
      versatileDamage = { dice: '1d8', type: 'piercing' };
    } else {
      damage = { dice: '1d8', type: 'slashing' };
      props = ['versatile'];
      versatileDamage = { dice: '1d10', type: 'slashing' };
    }

    let bonus: number | undefined;
    if (raw.name?.includes('+1')) bonus = 1;
    else if (raw.name?.includes('+2')) bonus = 2;
    else if (raw.name?.includes('+3')) bonus = 3;

    weapon = compact({
      category: 'martial',
      kind,
      damage,
      versatileDamage,
      properties: props,
      range,
      bonus,
    });
  }

  let armor: Record<string, unknown> | undefined;
  if (category === 'armor' || category === 'shield') {
    const isShield = category === 'shield';
    let armorCat = isShield ? 'shield' : 'medium';
    const lowerName = String(raw.name ?? '').toLowerCase();
    if (
      lowerName.includes('plate') ||
      lowerName.includes('chain mail') ||
      lowerName.includes('splint')
    ) {
      armorCat = 'heavy';
    } else if (lowerName.includes('leather') || lowerName.includes('padded')) {
      armorCat = 'light';
    }

    let bonus: number | undefined;
    if (raw.name?.includes('+1')) bonus = 1;
    else if (raw.name?.includes('+2')) bonus = 2;
    else if (raw.name?.includes('+3')) bonus = 3;

    armor = compact({
      category: armorCat,
      baseAc: isShield
        ? 2
        : armorCat === 'heavy'
          ? 18
          : armorCat === 'light'
            ? 12
            : 14,
      dexBonus: isShield ? false : armorCat !== 'heavy',
      maxDexBonus: armorCat === 'medium' ? 2 : undefined,
      stealthDisadvantage: armorCat === 'heavy',
      bonus,
    });
  }

  const slug = raw.index || slugify(String(raw.name ?? ''));
  return {
    entityType: 'item',
    ruleset,
    slug,
    sourceId: raw.index ?? raw.name,
    warnings,
    data: compact({
      ruleset,
      name: raw.name,
      category,
      rarity: rawRarity,
      attunement,
      weapon,
      armor,
      text,
    }),
  };
}

// -- monsters ------------------------------------------------------------

const DAMAGE_TYPES = DamageTypeSchema.options;

/** "bludgeoning, piercing, and slashing from nonmagical attacks" -> three entries. */
export function parseDamageDefenses(
  entries: string[],
  warnings: string[],
): Array<Record<string, unknown>> {
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
    const qualifier = entry
      .slice(lastEnd)
      .replace(/^[\s,]*(damage\s*)?/i, '')
      .trim();
    for (const { type } of found)
      result.push(compact({ type, qualifier: qualifier || undefined }));
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
      return {
        type: 'recharge_after_rest',
        rest: (raw.rest_types ?? []).includes('short') ? 'short' : 'long',
      };
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
    if (index.startsWith('saving-throw-'))
      savingThrows[index.slice('saving-throw-'.length)] = proficiency.value;
    else if (index.startsWith('skill-'))
      skills[index.slice('skill-'.length).replace(/-/g, '_')] =
        proficiency.value;
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
          ? (ac.armor ?? []).map((a: Raw) => a.name.toLowerCase()).join(', ') ||
            undefined
          : ac.type === 'spell'
            ? ac.spell?.name?.toLowerCase()
            : undefined;
    return compact({
      value: ac.value,
      source,
      condition: ac.condition
        ? `while ${ac.condition.name.toLowerCase()}`
        : undefined,
    });
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
      hitPoints: {
        average: raw.hit_points,
        formula: String(raw.hit_points_roll ?? '').replace(/\s+/g, ''),
      },
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
      damageVulnerabilities: parseDamageDefenses(
        raw.damage_vulnerabilities ?? [],
        warnings,
      ),
      damageResistances: parseDamageDefenses(
        raw.damage_resistances ?? [],
        warnings,
      ),
      damageImmunities: parseDamageDefenses(
        raw.damage_immunities ?? [],
        warnings,
      ),
      conditionImmunities: (raw.condition_immunities ?? []).map(
        (c: Raw) => c.index,
      ),
      senses,
      languages,
      challengeRating: raw.challenge_rating,
      xp: raw.xp,
      proficiencyBonus: raw.proficiency_bonus,
      traits: (raw.special_abilities ?? [])
        .filter((a: Raw) => !a.spellcasting)
        .map(featureFrom),
      actions: (raw.actions ?? []).map(featureFrom),
      reactions: (raw.reactions ?? []).map(featureFrom),
      legendaryActions:
        legendary.length > 0
          ? { usesPerRound: 3, actions: legendary }
          : undefined,
      spellcasting: spellcasting.length > 0 ? spellcasting : undefined,
    }),
  };
}
