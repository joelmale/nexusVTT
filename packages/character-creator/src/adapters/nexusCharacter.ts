/**
 * Conversion between the creator's internal character model and the shared
 * `@nexus/character-contracts` model that Nexus VTT persists.
 *
 * There is exactly one conversion implementation. The live creator
 * (`onComplete`) and the JSON import path (a previously exported Forge
 * character) both run through `toNexusCharacter`, so a field preserved for one
 * is preserved for both.
 *
 * Design rule: nothing is silently discarded. Every field the creator can
 * produce either maps onto a contract field or is explicitly listed in
 * `UNMAPPED_CREATOR_FIELDS` below with the reason.
 */

import {
  calculateAbilityModifier,
  calculateProficiencyBonus,
  STANDARD_SKILLS,
} from '@nexus/character-contracts';
import type {
  AbilityKey,
  AbilityScores,
  Character as NexusCharacter,
  EquippedWeapon,
  ForgeCharacter,
  InventoryItem,
  SkillEntry,
  SkillMap,
} from '@nexus/character-contracts';

import { loadClasses } from '../services/dataService';
import type { Character as CreatedCharacter } from '../types/dnd';

/**
 * Creator fields intentionally not carried into the VTT contract, with the
 * reason. Kept as a checked list so adding a creator field without deciding
 * what happens to it shows up in review.
 */
export const UNMAPPED_CREATOR_FIELDS: ReadonlyArray<{
  field: string;
  reason: string;
}> = [
  {
    field: 'race',
    reason:
      'Deprecated Forge alias for `species`; the contract keeps both and fills ' +
      '`race` from `species` when absent.',
  },
];

const ABILITY_KEYS: AbilityKey[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

/**
 * Forge writes skill keys without separators (`AnimalHandling`); the VTT
 * contract uses the display names in `STANDARD_SKILLS` (`Animal Handling`).
 */
export function normalizeSkillKey(name: string): string {
  const explicit: Record<string, string> = {
    AnimalHandling: 'Animal Handling',
    SleightOfHand: 'Sleight of Hand',
  };
  if (explicit[name]) return explicit[name];
  if (name.includes(' ')) return name;
  return name.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Resolves an inventory entry from either the canonical Forge shape
 * (`equipmentSlug`) or the older export shape (`id`/`name`), preserving the
 * per-item detail the previous adapter dropped.
 */
function toInventoryItem(item: Record<string, unknown>): InventoryItem {
  const slugSource =
    (item.equipmentSlug as string) ||
    (item.id as string) ||
    (item.name as string) ||
    '';

  const inventoryItem: InventoryItem = {
    equipmentSlug: (item.equipmentSlug as string) || slugify(slugSource),
    quantity: typeof item.quantity === 'number' ? item.quantity : 1,
  };

  if (typeof item.name === 'string') inventoryItem.name = item.name;
  if (typeof item.equipped === 'boolean') inventoryItem.equipped = item.equipped;
  if (typeof item.attuned === 'boolean') inventoryItem.attuned = item.attuned;
  if (typeof item.notes === 'string') inventoryItem.notes = item.notes;
  if (typeof item.weight === 'number') inventoryItem.weight = item.weight;
  if (typeof item.description === 'string')
    inventoryItem.description = item.description;
  if (typeof item.type === 'string') inventoryItem.type = item.type;
  if (item.trinket)
    inventoryItem.trinket = item.trinket as InventoryItem['trinket'];

  return inventoryItem;
}

/**
 * Forge stores equipped weapons as equipment slugs; older exports used
 * objects. Both normalise to the contract's `EquippedWeapon`.
 */
function toEquippedWeapons(
  weapons: ReadonlyArray<string | EquippedWeapon> | undefined,
): EquippedWeapon[] | undefined {
  if (!weapons) return undefined;
  return weapons.map((weapon) =>
    typeof weapon === 'string'
      ? { weaponSlug: weapon, equipped: true, quantity: 1 }
      : weapon,
  );
}

function toAbilityScores(
  abilities: CreatedCharacter['abilities'] | undefined,
): AbilityScores {
  const result = {} as AbilityScores;
  for (const key of ABILITY_KEYS) {
    const score = abilities?.[key]?.score ?? 10;
    result[key] = { score, modifier: calculateAbilityModifier(score) };
  }
  return result;
}

function toSkillMap(
  skills: Record<string, SkillEntry> | undefined,
  abilities: AbilityScores,
): SkillMap {
  // Start from a complete, correctly-keyed skill list so a partial Forge
  // payload never leaves the VTT sheet with missing rows.
  const result: SkillMap = {};
  for (const skill of STANDARD_SKILLS) {
    result[skill.name] = {
      proficient: false,
      value: abilities[skill.ability].modifier,
    };
  }

  for (const [name, skill] of Object.entries(skills ?? {})) {
    if (!skill) continue;
    const key = normalizeSkillKey(name);
    result[key] = {
      proficient: !!skill.proficient,
      value: typeof skill.value === 'number' ? skill.value : (result[key]?.value ?? 0),
      ...(skill.expertise !== undefined ? { expertise: skill.expertise } : {}),
    };
  }

  return result;
}

/**
 * Saving throws are derived in the creator rather than stored, so they are
 * recomputed here from the class's proficient saves. Callers that know the
 * class's save list pass it in; otherwise existing values are preserved.
 */
function toSavingThrowProficiencies(
  proficientSaves: ReadonlyArray<string> | undefined,
): Record<AbilityKey, boolean> | undefined {
  if (!proficientSaves || proficientSaves.length === 0) return undefined;

  const normalized = new Set(
    proficientSaves.map((save) => save.slice(0, 3).toUpperCase()),
  );
  return ABILITY_KEYS.reduce(
    (acc, key) => {
      acc[key] = normalized.has(key);
      return acc;
    },
    {} as Record<AbilityKey, boolean>,
  );
}

export interface ToNexusCharacterOptions {
  /** Owner of the resulting character in the host application. */
  playerId?: string;
  /**
   * Proficient saving throws for the character's class (e.g. `['STR','CON']`
   * or SRD display names). The creator derives saves rather than storing them.
   */
  proficientSaves?: ReadonlyArray<string>;
  /** Overrides `new Date().toISOString()`, for deterministic tests. */
  now?: string;
}

/**
 * Converts a character produced by the shared creator (or parsed from a Forge
 * JSON export) into the VTT's contract model.
 */
export function toNexusCharacter(
  source: CreatedCharacter | ForgeCharacter,
  options: ToNexusCharacterOptions = {},
): NexusCharacter {
  const created = source as CreatedCharacter & ForgeCharacter;
  const now = options.now ?? new Date().toISOString();

  const abilities = toAbilityScores(created.abilities);
  const level = created.level || 1;
  const skills = toSkillMap(
    created.skills as unknown as Record<string, SkillEntry>,
    abilities,
  );

  const species = created.species || created.race || '';
  const savingThrowProficiencies = toSavingThrowProficiencies(
    options.proficientSaves,
  );

  const character: NexusCharacter = {
    id: created.id,
    playerId: options.playerId,
    name: created.name,

    // Identity — `race` is kept populated for consumers that predate the
    // species rename, without losing the creator's own `species`.
    species,
    race: created.race || species,
    selectedSpeciesVariant: created.selectedSpeciesVariant,
    selectedLineage: created.selectedLineage,
    class: created.class,
    classSlug: created.classSlug,
    subclass: created.subclass ?? null,
    background: created.background,
    alignment: created.alignment,
    edition: created.edition,
    level,

    // Core stats
    proficiencyBonus:
      created.proficiencyBonus ?? calculateProficiencyBonus(level),
    armorClass: created.armorClass,
    hitPoints: created.hitPoints,
    maxHitPoints: created.maxHitPoints,
    temporaryHitPoints: created.temporaryHitPoints ?? 0,
    hitDice: created.hitDice,
    speed: created.speed,
    initiative: created.initiative,
    inspiration: created.inspiration,
    heroicInspiration: created.heroicInspiration,
    experiencePoints: created.experiencePoints,

    abilities,
    skills,
    ...(savingThrowProficiencies ? { savingThrowProficiencies } : {}),

    // Proficiencies and languages
    languages: created.languages,
    proficiencies: created.proficiencies,
    expertiseSkills: created.expertiseSkills,
    weaponMastery: created.weaponMastery,

    // Features, traits and progression
    featuresAndTraits: created.featuresAndTraits
      ? {
          personality: created.featuresAndTraits.personality,
          ideals: created.featuresAndTraits.ideals,
          bonds: created.featuresAndTraits.bonds,
          flaws: created.featuresAndTraits.flaws,
          classFeatures: created.featuresAndTraits.classFeatures,
          // The VTT sheet reads `racialTraits`; the creator speaks "species".
          // Both are written so neither side loses the data.
          racialTraits: created.featuresAndTraits.speciesTraits,
          speciesTraits: created.featuresAndTraits.speciesTraits,
          backgroundFeatures: created.featuresAndTraits.backgroundFeatures,
          musicalInstrumentProficiencies:
            created.featuresAndTraits.musicalInstrumentProficiencies,
        }
      : undefined,
    srdFeatures: created.srdFeatures,
    selectedFeats: created.selectedFeats,
    feats: created.feats,
    featChoices: created.featChoices,
    featEffects: created.featEffects,
    levelHistory: created.levelHistory,
    backgroundFeat: created.backgroundFeat,
    originFeat: created.originFeat,

    // 2024 class choices
    divineOrder: created.divineOrder,
    primalOrder: created.primalOrder,
    pactBoon: created.pactBoon,
    fightingStyle: created.fightingStyle,
    selectedFightingStyle: created.selectedFightingStyle,
    eldritchInvocations: created.eldritchInvocations,

    // Spellcasting
    spellcasting: created.spellcasting,

    // Equipment
    inventory: created.inventory?.map((item) =>
      toInventoryItem(item as unknown as Record<string, unknown>),
    ),
    equippedWeapons: toEquippedWeapons(created.equippedWeapons),
    equippedArmor: created.equippedArmor,
    currency: created.currency,
    trinket: created.trinket,

    // Resources and combat state
    resources: created.resources as unknown[] | undefined,
    secondWindUses: created.secondWindUses,
    actionSurgeUsed: created.actionSurgeUsed,
    deathSaves: created.deathSaves,
    conditions: created.conditions,

    createdAt: created.createdAt || now,
    updatedAt: created.updatedAt || now,
  };

  return character;
}

/**
 * Resolves a class's proficient saving throws from the creator's own rules
 * data, so hosts do not have to hard-code a second copy of the class table.
 * Returns `undefined` when the class cannot be resolved.
 */
export function resolveProficientSaves(
  classIdentifier: string | undefined,
  edition?: CreatedCharacter['edition'],
): string[] | undefined {
  if (!classIdentifier) return undefined;
  const needle = classIdentifier.toLowerCase();
  const match = loadClasses(edition).find(
    (candidate) =>
      candidate.slug.toLowerCase() === needle ||
      candidate.name.toLowerCase() === needle,
  );
  return match?.save_throws;
}

/**
 * Convenience wrapper used by hosts converting a freshly created character:
 * resolves the class's saving throws automatically.
 */
export function createdCharacterToNexus(
  created: CreatedCharacter,
  options: ToNexusCharacterOptions = {},
): NexusCharacter {
  return toNexusCharacter(created, {
    ...options,
    proficientSaves:
      options.proficientSaves ??
      resolveProficientSaves(created.classSlug || created.class, created.edition),
  });
}
