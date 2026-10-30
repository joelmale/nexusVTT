import type {
  AbilityName,
  CharacterCreationData,
} from '../../types/dnd';
import { calculateCharacterStats } from '../../utils/characterCreationUtils';
import { loadClasses, SPELL_DATABASE } from '../../services/dataService';
import { classSpellSlots } from '../../utils/classSpellSlots';
import { humanizeId } from '../../utils/displayLabels';
import backgroundsData from '../../data/backgrounds.json';

/**
 * What the live character sheet shows for a draft in progress.
 *
 * A value is `null` until the choice it depends on has been made, so the
 * sheet shows "—" with a hint instead of a number that looks real but isn't
 * (an armor class computed from unassigned ability scores, say).
 */
export type SheetSection =
  | 'identity'
  | 'species'
  | 'class'
  | 'abilities'
  | 'magic'
  | 'story';

export interface LiveSheetModel {
  name: string | null;
  speciesName: string | null;
  className: string | null;
  subclassName: string | null;
  backgroundName: string | null;
  level: number;
  vitals: {
    hitPoints: number | null;
    armorClass: number | null;
    speed: number | null;
    initiative: number | null;
    proficiencyBonus: number;
  };
  abilities: Array<{
    key: AbilityName;
    score: number | null;
    modifier: number | null;
    savingThrow: boolean;
  }>;
  skills: string[];
  spellcasting: {
    ability: string;
    saveDC: number | null;
    attackBonus: number | null;
    slots: Array<{ level: number; count: number }>;
    pactMagic: boolean;
    cantrips: string[];
    spells: string[];
  } | null;
  traits: string[];
  features: string[];
  /** What the player still needs to choose, per section, in plain words. */
  pending: Partial<Record<SheetSection, string>>;
}

const ABILITIES: AbilityName[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

const spellName = (slug: string) =>
  SPELL_DATABASE.find((spell) => spell.slug === slug)?.name ?? humanizeId(slug);

/** Backgrounds are stored by slug ("sage-2024"); show the real name. */
function backgroundName(slug: string): string {
  const match = (backgroundsData as Array<{ slug?: string; name?: string }>).find(
    (entry) => entry.slug === slug,
  );
  return match?.name ?? humanizeId(slug.replace(/-20(14|24)$/, ""));
}

/** In 2024 the background step also sets its ability choices. */
function backgroundChosen(data: CharacterCreationData): boolean {
  if (!data.background) return false;
  return data.edition !== '2024' || Boolean(data.backgroundAbilityChoices);
}

export function buildLiveSheet(data: CharacterCreationData): LiveSheetModel {
  const edition = data.edition === '2014' ? '2014' : '2024';
  const classChosen = Boolean(data.classSlug);
  const speciesChosen = Boolean(data.speciesSlug);
  const abilitiesAssigned = ABILITIES.every(
    (key) => (data.abilities?.[key] ?? 0) > 0,
  );
  const level = Math.max(1, data.level || 1);
  const proficiencyBonus = 2 + Math.floor((level - 1) / 4);

  // The calculators expect a reasonably complete draft. Mid-wizard they
  // usually cope; if they don't, the sheet falls back to pending values
  // rather than taking the wizard down with it.
  let stats: ReturnType<typeof calculateCharacterStats> | null = null;
  try {
    stats = calculateCharacterStats(data);
  } catch {
    stats = null;
  }

  const classData = classChosen
    ? loadClasses(edition).find((c) => c.slug === data.classSlug)
    : undefined;
  const saves = new Set<string>(classData?.save_throws ?? []);

  const pending: LiveSheetModel['pending'] = {};
  if (!speciesChosen) pending.species = 'Choose a species';
  if (!classChosen) pending.class = 'Choose a class';
  if (!abilitiesAssigned) pending.abilities = 'Assign ability scores';
  if (!data.name?.trim()) pending.story = 'Name your character';
  if (!backgroundChosen(data)) pending.identity = 'Choose a background';

  const abilities = ABILITIES.map((key) => {
    const ability = stats?.abilities?.[key];
    return {
      key,
      score: abilitiesAssigned && ability ? ability.score : null,
      modifier: abilitiesAssigned && ability ? ability.modifier : null,
      savingThrow: saves.has(key),
    };
  });

  const skills = stats
    ? Object.entries(stats.skills ?? {})
        .filter(([, skill]) => skill?.proficient)
        .map(([name]) => humanizeId(name))
    : [];

  let spellcasting: LiveSheetModel['spellcasting'] = null;
  const slotCounts = classChosen
    ? classSpellSlots(data.classSlug, edition, level)
    : [];
  const casting = stats?.spellcasting;
  if (casting || slotCounts.some((count) => count > 0)) {
    const selection = data.spellSelection;
    const spells = [
      ...new Set([
        ...(data.classSlug === 'wizard'
          ? (selection?.dailyPrepared ?? [])
          : [
              ...(selection?.preparedSpells ?? []),
              ...(selection?.knownSpells ?? []),
            ]),
      ]),
    ];
    spellcasting = {
      ability: casting?.ability ?? classData?.spellcasting?.ability ?? '',
      saveDC: abilitiesAssigned && casting ? casting.spellSaveDC : null,
      attackBonus: abilitiesAssigned && casting ? casting.spellAttackBonus : null,
      slots: slotCounts
        .map((count, slotLevel) => ({ level: slotLevel, count }))
        .filter(({ level: slotLevel, count }) => slotLevel > 0 && count > 0),
      pactMagic: data.classSlug === 'warlock',
      cantrips: (selection?.selectedCantrips ?? []).map(spellName),
      spells: spells.map(spellName),
    };
    if (!spellcasting.cantrips.length && !spellcasting.spells.length)
      pending.magic = 'Choose spells';
  }

  return {
    name: data.name?.trim() || null,
    speciesName: speciesChosen && stats ? stats.species || humanizeId(data.speciesSlug) : null,
    className: classData?.name ?? (classChosen ? humanizeId(data.classSlug) : null),
    subclassName: stats?.subclass ? humanizeId(stats.subclass) : null,
    backgroundName: backgroundChosen(data) ? backgroundName(data.background) : null,
    level,
    vitals: {
      hitPoints: classChosen && abilitiesAssigned && stats ? stats.maxHitPoints : null,
      armorClass: abilitiesAssigned && stats ? stats.armorClass : null,
      speed: speciesChosen && stats ? stats.speed : null,
      initiative: abilitiesAssigned && stats ? stats.initiative : null,
      proficiencyBonus,
    },
    abilities,
    skills,
    spellcasting,
    traits: speciesChosen ? (stats?.featuresAndTraits?.speciesTraits ?? []) : [],
    features: classChosen ? (stats?.featuresAndTraits?.classFeatures ?? []) : [],
    pending,
  };
}
