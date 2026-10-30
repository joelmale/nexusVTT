import { getStartingEquipmentChoices } from './startingLoadout';
import { masteryCount, masteryOptions } from './classGrantChoices';
import { recommendedFeatProficiencies } from './featProficiencies';
/**
 * CC-302 & CC-303: Deterministic Recommendation Policies & Starter Packages
 *
 * Implements deterministic build resolution for newcomer and guided flows.
 * Guarantees legal, non-duplicating skills, scores, origins, masteries,
 * equipment, spellbook/preparation packages, and three first-turn explanations
 * derived from actual granted features.
 */

import type { CreationDraft, DraftEvaluationResult } from '../types/draft';
import type {
  Edition,
  AbilityName,
  SkillName,
  CharacterCreationData,
} from '../types/dnd';
import { evaluateDraft } from './draftEvaluator';
import {
  loadClasses,
  loadSpells,
  BACKGROUNDS,
  getAllSpecies,
  SPELLS_KNOWN_BY_CLASS,
} from './dataService';
import { calculatePreparationLimit } from '@nexus/rules-5e';
import { creationDataToDraft } from '../adapters/draftAdapter';
import { starterKitFor } from '../data/recommendations/2024/starterKits';

export type CombatIntent =
  'close_combat' | 'archery' | 'sneak' | 'cast' | 'support';

export interface RecommendationRequest {
  intent?: CombatIntent;
  classSlug?: string;
  speciesSlug?: string;
  edition: Edition;
  level?: number;
  name?: string;
}

import {
  FirstTurnGuidance,
  generateFirstTurnGuidance,
} from './guidanceService';
export type { FirstTurnGuidance };
export { generateFirstTurnGuidance };

export interface RecommendationResult {
  draft: CreationDraft;
  reasons: {
    classReason: string;
    speciesReason: string;
    abilitiesReason: string;
    skillsReason: string;
    equipmentReason: string;
    spellsReason?: string;
  };
  firstTurnGuidance: FirstTurnGuidance;
  evaluation: DraftEvaluationResult;
}

/**
 * Maps high-level intent to a primary class.
 */
/** Skills that serve each class best, in priority order. */
const PREFERRED_CLASS_SKILLS: Record<string, string[]> = {
  barbarian: ['Athletics', 'Perception', 'Survival'],
  bard: ['Persuasion', 'Performance', 'Deception', 'Insight', 'Perception'],
  cleric: ['Insight', 'Medicine', 'Persuasion', 'Religion'],
  druid: ['Perception', 'Nature', 'Survival', 'Medicine', 'Animal Handling'],
  fighter: ['Athletics', 'Perception', 'Intimidation', 'Survival'],
  monk: ['Acrobatics', 'Stealth', 'Insight', 'Athletics'],
  paladin: ['Athletics', 'Persuasion', 'Insight', 'Intimidation'],
  ranger: ['Perception', 'Stealth', 'Survival', 'Nature', 'Athletics'],
  rogue: [
    'Stealth',
    'Perception',
    'Acrobatics',
    'Sleight of Hand',
    'Investigation',
    'Insight',
    'Deception',
    'Persuasion',
  ],
  sorcerer: ['Arcana', 'Persuasion', 'Insight', 'Deception'],
  warlock: ['Arcana', 'Investigation', 'Deception', 'Intimidation'],
  wizard: ['Arcana', 'Investigation', 'Insight', 'History', 'Medicine'],
};

/**
 * Choose class skills that suit the class, skipping any the background already
 * grants. Falls back to list order only when the preferences run out.
 */
export function pickRecommendedClassSkills(
  classSlug: string,
  available: readonly string[],
  backgroundSkills: ReadonlySet<string>,
  count: number,
): string[] {
  const normalize = (skill: string) => skill.toLowerCase().replace(/[^a-z]/g, '');
  const usable = available.filter((skill) => !backgroundSkills.has(skill));
  const picked: string[] = [];
  for (const preferred of PREFERRED_CLASS_SKILLS[classSlug] ?? []) {
    const match = usable.find((skill) => normalize(skill) === normalize(preferred));
    if (match && !picked.includes(match)) picked.push(match);
  }
  for (const skill of usable) if (!picked.includes(skill)) picked.push(skill);
  return picked.slice(0, count);
}

export function intentToClass(intent: CombatIntent): string {
  switch (intent) {
    case 'close_combat':
      return 'fighter';
    case 'archery':
      return 'fighter';
    case 'sneak':
      return 'rogue';
    case 'cast':
      return 'wizard';
    case 'support':
      return 'cleric';
    default:
      return 'fighter';
  }
}

/**
 * Standard Array distributions tailored per class role.
 */
const CLASS_ABILITY_PROFILES: Record<string, Record<AbilityName, number>> = {
  fighter_melee: { STR: 15, CON: 14, DEX: 13, WIS: 12, CHA: 10, INT: 8 },
  fighter_archery: { DEX: 15, CON: 14, STR: 13, WIS: 12, CHA: 10, INT: 8 },
  rogue: { DEX: 15, CON: 14, INT: 13, WIS: 12, CHA: 10, STR: 8 },
  wizard: { INT: 15, DEX: 14, CON: 13, WIS: 12, CHA: 10, STR: 8 },
  cleric: { WIS: 15, CON: 14, STR: 13, CHA: 12, INT: 10, DEX: 8 },
  paladin: { STR: 15, CHA: 14, CON: 13, WIS: 12, DEX: 10, INT: 8 },
  barbarian: { STR: 15, CON: 14, DEX: 13, WIS: 12, CHA: 10, INT: 8 },
  ranger: { DEX: 15, WIS: 14, CON: 13, STR: 12, INT: 10, CHA: 8 },
  warlock: { CHA: 15, CON: 14, DEX: 13, INT: 12, WIS: 10, STR: 8 },
  sorcerer: { CHA: 15, CON: 14, DEX: 13, WIS: 12, INT: 10, STR: 8 },
  bard: { CHA: 15, DEX: 14, CON: 13, WIS: 12, INT: 10, STR: 8 },
  druid: { WIS: 15, CON: 14, DEX: 13, INT: 12, STR: 10, CHA: 8 },
  monk: { DEX: 15, WIS: 14, CON: 13, STR: 12, INT: 10, CHA: 8 },
};

/**
 * CC-303: Starter spell packages for full and half casters.
 */
interface StarterSpellPackage {
  cantrips: string[];
  preparedSpells: string[];
  spellbook?: string[];
  explanation: string;
}

const STARTER_SPELL_PACKAGES: Record<string, StarterSpellPackage> = {
  wizard: {
    cantrips: ['fire-bolt', 'mage-hand', 'prestidigitation'],
    preparedSpells: ['magic-missile', 'shield', 'mage-armor', 'detect-magic'],
    spellbook: [
      'magic-missile',
      'shield',
      'mage-armor',
      'detect-magic',
      'sleep',
      'feather-fall',
    ],
    explanation:
      'Balanced offense (Fire Bolt, Magic Missile), emergency protection (Shield, Mage Armor), and utility exploration (Mage Hand, Detect Magic, Prestidigitation).',
  },
  cleric: {
    cantrips: ['sacred-flame', 'guidance', 'thaumaturgy'],
    preparedSpells: ['cure-wounds', 'healing-word', 'bless', 'guiding-bolt'],
    explanation:
      'Core divine package with offensive radiance (Sacred Flame, Guiding Bolt), team buffing (Bless), and life-saving triage (Healing Word, Cure Wounds).',
  },
  warlock: {
    cantrips: ['eldritch-blast', 'minor-illusion'],
    preparedSpells: ['armor-of-agathys', 'hex'],
    explanation:
      'Premier ranged firepower with Eldritch Blast, augmented by Hex and temporary warding from Armor of Agathys.',
  },
  sorcerer: {
    cantrips: [
      'fire-bolt',
      'ray-of-frost',
      'shocking-grasp',
      'prestidigitation',
    ],
    preparedSpells: ['magic-missile', 'shield'],
    explanation:
      'High-impact elemental magic with dual attack cantrips, melee escape, and impenetrable Shield.',
  },
  bard: {
    cantrips: ['vicious-mockery', 'minor-illusion'],
    preparedSpells: [
      'healing-word',
      'dissonant-whispers',
      'faerie-fire',
      'thunderwave',
    ],
    explanation:
      'Supportive battlefield control with Vicious Mockery disadvantage, bonus action Healing Word, and Faerie Fire advantage.',
  },
  druid: {
    cantrips: ['shillelagh', 'produce-flame'],
    preparedSpells: ['cure-wounds', 'entangle', 'healing-word', 'thunderwave'],
    explanation:
      'Primal mastery granting magical quarterstaff strikes via Shillelagh, area restraint with Entangle, and quick healing.',
  },
};

/**
 * Primary deterministic recommendation builder.
 */
export function getRecommendation(
  req: RecommendationRequest,
): RecommendationResult {
  const edition = req.edition;
  const intent = req.intent || 'close_combat';
  const targetClass = req.classSlug?.toLowerCase() || intentToClass(intent);

  // Available classes in this edition
  const availableClasses = loadClasses(edition);
  const classData = availableClasses.find(
    (c) =>
      c.slug === targetClass ||
      c.name.toLowerCase() === targetClass ||
      c.slug === `${targetClass}-${edition}`,
  );

  if (!classData)
    throw new Error(`Class ${targetClass} is unavailable in ${edition}.`);
  const finalClassSlug = classData.slug;
  const isArcher =
    intent === 'archery' || (finalClassSlug === 'rogue' && intent === 'sneak');

  // Species resolution
  const kit = edition === '2024' ? starterKitFor(finalClassSlug) : undefined;
  let speciesSlug = req.speciesSlug;
  if (!speciesSlug) {
    if (kit) {
      speciesSlug = isArcher ? 'elf-2024' : kit.speciesSlug;
    } else if (edition === '2024') {
      speciesSlug = isArcher ? 'elf-2024' : 'human-2024';
    } else {
      speciesSlug = isArcher ? 'elf' : 'human';
    }
  }

  // Ensure species exists in data matching the selected edition
  const allSpecies = getAllSpecies();
  const editionSpecies = allSpecies.filter((s) => s.edition === edition);
  const matchedSpecies =
    editionSpecies.find((s) => s.slug === speciesSlug) ||
    editionSpecies.find(
      (s) => s.name.toLowerCase() === speciesSlug?.toLowerCase(),
    ) ||
    undefined;
  if (!matchedSpecies)
    throw new Error(`Species ${speciesSlug} is unavailable in ${edition}.`);

  const fallbackSlug = edition === '2024' ? 'human-2024' : 'human';
  const finalSpeciesSlug = matchedSpecies ? matchedSpecies.slug : fallbackSlug;

  // Background resolution
  let backgroundSlug: string;
  if (kit) {
    backgroundSlug = kit.backgroundSlug;
  } else if (finalClassSlug === 'fighter') {
    backgroundSlug = edition === '2024' ? 'soldier-2024' : 'soldier-2014';
  } else if (finalClassSlug === 'rogue') {
    backgroundSlug = edition === '2024' ? 'criminal-2024' : 'criminal-2014';
  } else if (finalClassSlug === 'wizard') {
    backgroundSlug = edition === '2024' ? 'sage-2024' : 'sage-2014';
  } else if (finalClassSlug === 'cleric') {
    backgroundSlug = edition === '2024' ? 'acolyte-2024' : 'acolyte-2014';
  } else {
    backgroundSlug = edition === '2024' ? 'soldier-2024' : 'soldier-2014';
  }

  // Look up background data to avoid duplicate skills
  const bg = BACKGROUNDS.find(
    (b) =>
      b.slug === backgroundSlug ||
      b.slug === `${backgroundSlug}-${edition}` ||
      b.name.toLowerCase() === backgroundSlug.toLowerCase(),
  );
  const bgSkills = new Set(bg?.skill_proficiencies || []);

  // Class Skills: Pick legal non-duplicating skills
  const classAvailableSkills = classData?.skill_proficiencies || [];
  const selectedSkills: SkillName[] = [];
  const neededSkillCount = classData?.num_skill_choices || 2;

  selectedSkills.push(
    ...(pickRecommendedClassSkills(
      finalClassSlug,
      classAvailableSkills,
      bgSkills,
      neededSkillCount,
    ) as SkillName[]),
  );

  // Raw Ability Scores
  const profileKey =
    finalClassSlug === 'fighter' && isArcher
      ? 'fighter_archery'
      : finalClassSlug;
  const abilityScores =
    CLASS_ABILITY_PROFILES[profileKey] || CLASS_ABILITY_PROFILES.fighter_melee;

  // Background ASI (2024)
  const backgroundAbilityChoices =
    edition === '2024'
      ? kit && !(finalClassSlug === 'fighter' && isArcher)
        ? { method: '2/1' as const, bonuses: { ...kit.bonuses } }
        : finalClassSlug === 'fighter'
        ? isArcher
          ? { method: '2/1' as const, bonuses: { DEX: 2, CON: 1 } }
          : { method: '2/1' as const, bonuses: { STR: 2, CON: 1 } }
        : finalClassSlug === 'rogue'
          ? { method: '2/1' as const, bonuses: { DEX: 2, CON: 1 } }
          : finalClassSlug === 'wizard'
            ? { method: '2/1' as const, bonuses: { INT: 2, CON: 1 } }
            : finalClassSlug === 'cleric'
              ? { method: '2/1' as const, bonuses: { WIS: 2, CHA: 1 } }
              : { method: '2/1' as const, bonuses: { STR: 2, CON: 1 } }
      : undefined;

  // Expertise (Rogue)
  const proficientSkills = [
    ...new Set([...selectedSkills, ...(bg?.skill_proficiencies || [])]),
  ];
  const normalizeSkill = (skill: string) =>
    skill.toLowerCase().replace(/[^a-z]/g, '');
  const preferredExpertise = ['Stealth', 'Sleight of Hand'].filter((skill) =>
    proficientSkills.some(
      (value) => normalizeSkill(value) === normalizeSkill(skill),
    ),
  );
  const expertiseSkills =
    finalClassSlug === 'rogue'
      ? [
          ...preferredExpertise,
          ...proficientSkills.filter(
            (skill) =>
              !preferredExpertise.some(
                (value) => normalizeSkill(value) === normalizeSkill(skill),
              ),
          ),
        ].slice(0, 2)
      : undefined;

  // Fighting Style (Fighter, Paladin, Ranger)
  const fightingStyle =
    finalClassSlug === 'fighter'
      ? isArcher
        ? 'Archery'
        : 'Defense'
      : undefined;

  // Weapon Masteries (2024 Fighter, Rogue, Barbarian, Paladin)
  let weaponMastery: string[] | undefined;
  if (edition === '2024') {
    if (finalClassSlug === 'fighter') {
      weaponMastery = isArcher
        ? ['Heavy Crossbow', 'Longbow', 'Shortsword']
        : ['Greatsword', 'Flail', 'Javelin'];
    } else if (finalClassSlug === 'rogue') {
      weaponMastery = ['Shortbow', 'Dagger'];
    }
  }

  // Spells
  const spellPkg = STARTER_SPELL_PACKAGES[finalClassSlug];
  const classSpells = loadSpells(edition).filter((spell) =>
    spell.classes.includes(finalClassSlug),
  );
  const completeSpellList = (
    preferred: string[],
    count: number,
    spellLevel: number,
  ) =>
    [
      ...new Set([
        ...preferred.filter((slug) =>
          classSpells.some(
            (spell) => spell.slug === slug && spell.level === spellLevel,
          ),
        ),
        ...classSpells
          .filter((spell) => spell.level === spellLevel)
          .map((spell) => spell.slug),
      ]),
    ].slice(0, count);
  const cantrips = completeSpellList(
    spellPkg?.cantrips || [],
    classData?.spellcasting?.cantripsKnown ?? 0,
    0,
  );
  const knownCount =
    edition === '2024'
      ? calculatePreparationLimit(finalClassSlug, req.level || 1, 0, edition)
      : ((SPELLS_KNOWN_BY_CLASS as Record<string, Record<string, number>>)[
          finalClassSlug
        ]?.[req.level || 1] ??
        classData?.spellcasting?.spellsKnownOrPrepared ??
        0);
  const preparedSpells = completeSpellList(
    spellPkg?.preparedSpells || [],
    spellPkg
      ? Math.min(spellPkg.preparedSpells.length, knownCount)
      : knownCount,
    1,
  );
  const spellbook = completeSpellList(
    spellPkg?.spellbook || [],
    finalClassSlug === 'wizard' ? 6 : 0,
    1,
  );

  // Assemble CharacterCreationData to adapt cleanly into CreationDraft
  const creationData: CharacterCreationData = {
    name: req.name || 'Hero',
    edition,
    level: req.level || 1,
    speciesSlug: finalSpeciesSlug,
    selectedLineage: finalSpeciesSlug.includes('elf')
      ? finalSpeciesSlug.includes('high') || finalClassSlug === 'wizard'
        ? 'high-elf'
        : 'wood-elf'
      : undefined,
    classSlug: finalClassSlug,
    subclassSlug:
      edition === '2014'
        ? (
            {
              cleric: 'life',
              sorcerer: 'draconic',
              warlock: 'fiend',
            } as Record<string, string>
          )[finalClassSlug]
        : undefined,
    background: backgroundSlug,
    alignment: 'Neutral Good',
    abilities: { ...abilityScores },
    abilityScoreMethod: 'standard-array',
    backgroundAbilityChoices,
    selectedSkills,
    speciesSkillProficiency:
      edition === '2024' &&
      ['human-2024', 'elf-2024'].includes(finalSpeciesSlug)
        ? (['Perception', 'Insight', 'Survival'].find(
            (skill) =>
              !proficientSkills.some(
                (value) => normalizeSkill(value) === normalizeSkill(skill),
              ),
          ) as SkillName)
        : undefined,
    humanOriginFeat:
      edition === '2024' && finalSpeciesSlug === 'human-2024'
        ? 'tough'
        : undefined,
    expertiseSkills,
    selectedFightingStyle: fightingStyle,
    weaponMastery:
      weaponMastery ??
      masteryOptions({ classSlug: finalClassSlug, edition })
        .slice(0, masteryCount({ classSlug: finalClassSlug, edition }))
        .map((weapon) => weapon.name),
    equipmentChoices: getStartingEquipmentChoices(
      { classSlug: finalClassSlug, edition },
      isArcher,
    ),
    selectedMusicalInstruments:
      finalClassSlug === 'bard' ? ['Lute', 'Flute', 'Drum'] : [],
    divineOrder:
      finalClassSlug === 'cleric' && edition === '2024'
        ? 'protector'
        : undefined,
    primalOrder:
      finalClassSlug === 'druid' && edition === '2024' ? 'warden' : undefined,
    eldritchInvocations:
      finalClassSlug === 'warlock' && edition === '2024'
        ? ['eldritch-mind']
        : undefined,
    hpCalculationMethod: 'max',
    spellSelection: {
      selectedCantrips: cantrips,
      knownSpells: finalClassSlug === 'wizard' ? [] : preparedSpells,
      preparedSpells,
      dailyPrepared: finalClassSlug === 'wizard' ? preparedSpells : undefined,
      spellbook: finalClassSlug === 'wizard' ? spellbook : undefined,
    },
    personality: 'Prepared and dependable.',
    ideals: 'Courage: Never back down from protecting others.',
    bonds: 'My companions can count on me in battle.',
    flaws: 'I sometimes underestimate unknown hazards.',
  };

  creationData.featChoices = recommendedFeatProficiencies(creationData);
  const draft = creationDataToDraft(creationData, {
    provenance: 'recommended',
  });
  if (isArcher) {
    const ranged = draft.loadout.items.find((item) =>
      /bow|crossbow/i.test(item.name),
    );
    if (ranged)
      draft.loadout.items = draft.loadout.items.map((item) => ({
        ...item,
        equipped:
          item.id === ranged.id || (item.equipped && item.slot === 'armor'),
      }));
  }

  // Evaluate Draft
  const evaluation = evaluateDraft(draft);

  // Generate First-Turn Guidance (CC-303)
  const firstTurnGuidance = generateFirstTurnGuidance(draft, isArcher);

  // Reasons text
  const reasons = {
    classReason: `Recommended ${classData?.name || finalClassSlug} to match ${intent.replace('_', ' ')} playstyle.`,
    speciesReason: `Selected ${matchedSpecies.name} for natural synergy with ${classData?.name}.`,
    abilitiesReason: `Standard array prioritized ${Object.entries(abilityScores)
      .slice(0, 2)
      .map(([k, v]) => `${k} (${v})`)
      .join(' and ')} for primary effectiveness.`,
    skillsReason: `Chose non-overlapping class proficiencies (${selectedSkills.join(', ')}) complementing your background.`,
    equipmentReason: `Equipped with starting package designed for immediate combat readiness.`,
    spellsReason: spellPkg ? spellPkg.explanation : undefined,
  };

  return {
    draft,
    reasons,
    firstTurnGuidance,
    evaluation,
  };
}
