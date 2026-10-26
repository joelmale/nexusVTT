import { AbilityName, CharacterCreationData, SkillName } from '../types/dnd';
import { CreationDraft, DraftProvenance } from '../types/draft';
import { resolveLoadout } from '../services/loadoutResolver';

export interface DraftAdapterOptions {
  draftId?: string;
  characterId?: string;
  provenance?: DraftProvenance;
  revision?: number;
  attemptId?: string;
}

/**
 * Maps abilityScoreMethod from wizard into draft abilityMethod
 */
function toDraftAbilityMethod(
  method?: CharacterCreationData['abilityScoreMethod'],
): CreationDraft['abilityMethod'] {
  switch (method) {
    case 'point-buy':
      return 'point-buy';
    case 'standard-array':
      return 'standard';
    case 'standard-roll':
    case 'classic-roll':
    case '5d6-drop-2':
    case 'custom':
      return 'manual';
    default:
      return 'preset';
  }
}

/**
 * Maps draft abilityMethod back to wizard abilityScoreMethod
 */
function toWizardAbilityScoreMethod(
  method: CreationDraft['abilityMethod'],
): CharacterCreationData['abilityScoreMethod'] {
  switch (method) {
    case 'point-buy':
      return 'point-buy';
    case 'standard':
      return 'standard-array';
    case 'manual':
      return 'standard-roll';
    default:
      return 'standard-array';
  }
}

/**
 * Converts intermediate CharacterCreationData to a canonical versioned CreationDraft (CC-201)
 */
export function creationDataToDraft(
  data: CharacterCreationData,
  options: DraftAdapterOptions = {},
): CreationDraft {
  const defaultProv: DraftProvenance = options.provenance || 'player';
  const provenance: Record<string, DraftProvenance> = {
    species: defaultProv,
    class: defaultProv,
    background: defaultProv,
    abilities: defaultProv,
    skills: defaultProv,
    spells: defaultProv,
    equipment: defaultProv,
  };

  const spells = {
    cantrips: [...(data.spellSelection?.selectedCantrips || [])],
    knownOrBook: [
      ...new Set([
        ...(data.spellSelection?.knownSpells || []),
        ...(data.spellSelection?.spellbook || []),
      ]),
    ],
    prepared: [
      ...(data.spellSelection?.dailyPrepared ||
        data.spellSelection?.preparedSpells ||
        []),
    ],
  };

  const loadout = resolveLoadout(data);

  return {
    draftVersion: 1,
    revision: options.revision ?? 0,
    attemptId: options.attemptId || globalThis.crypto.randomUUID(),
    creationData: structuredClone(data),
    draftId:
      options.draftId ||
      `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    characterId: options.characterId || globalThis.crypto.randomUUID(),
    edition: data.edition || '2024',
    level: data.level || 1,
    name: data.name || '',
    speciesSlug: data.speciesSlug,
    lineageSlug: data.selectedLineage || data.selectedSpeciesVariant,
    classSlug: data.classSlug,
    subclassSlug: data.subclassSlug || undefined,
    backgroundSlug: data.background,
    rawAbilityScores: {
      STR: data.abilities?.STR ?? 10,
      DEX: data.abilities?.DEX ?? 10,
      CON: data.abilities?.CON ?? 10,
      INT: data.abilities?.INT ?? 10,
      WIS: data.abilities?.WIS ?? 10,
      CHA: data.abilities?.CHA ?? 10,
    },
    abilityMethod: toDraftAbilityMethod(data.abilityScoreMethod),
    abilityBonuses: {
      method: data.backgroundAbilityChoices?.method,
      bonuses:
        data.backgroundAbilityChoices?.bonuses ||
        data.variantAbilityBonuses ||
        {},
    },
    skills: (data.selectedSkills || []).map((s) => String(s)),
    expertise: [...(data.expertiseSkills || [])],
    fightingStyle:
      data.fightingStyle || data.selectedFightingStyle || undefined,
    weaponMastery: data.weaponMastery ? [...data.weaponMastery] : undefined,
    originFeat: data.originFeat || data.backgroundFeat || undefined,
    speciesFeat: data.speciesFeat || data.humanOriginFeat || undefined,
    languages: [...(data.knownLanguages || [])],
    toolProficiencies: [...(data.backgroundTools || [])],
    spells,
    loadout,
    alignment: data.alignment,
    personality: data.personality,
    ideals: data.ideals,
    bonds: data.bonds,
    flaws: data.flaws,
    provenance,
  };
}

/**
 * Converts a canonical CreationDraft back to CharacterCreationData for wizard consumption (CC-201)
 */
export function draftToCreationData(
  draft: CreationDraft,
): CharacterCreationData {
  return {
    ...structuredClone(draft.creationData || {}),
    name: draft.name,
    level: draft.level,
    edition: draft.edition,
    speciesSlug: draft.speciesSlug || '',
    selectedLineage: draft.lineageSlug,
    selectedSpeciesVariant: draft.lineageSlug,
    classSlug: draft.classSlug || '',
    subclassSlug: draft.subclassSlug || null,
    background: draft.backgroundSlug || '',
    alignment: draft.alignment || 'True Neutral',
    abilities: { ...draft.rawAbilityScores },
    abilityScoreMethod: toWizardAbilityScoreMethod(draft.abilityMethod),
    backgroundAbilityChoices: draft.abilityBonuses?.method
      ? {
          method: draft.abilityBonuses.method,
          bonuses: { ...draft.abilityBonuses.bonuses },
        }
      : undefined,
    variantAbilityBonuses: draft.abilityBonuses?.bonuses as
      Record<AbilityName, number> | undefined,
    selectedSkills: (draft.skills || []) as SkillName[],
    expertiseSkills: [...(draft.expertise || [])],
    fightingStyle: draft.fightingStyle,
    selectedFightingStyle: draft.fightingStyle || null,
    weaponMastery: draft.weaponMastery,
    originFeat: draft.originFeat,
    backgroundFeat: draft.originFeat,
    speciesFeat: draft.speciesFeat,
    humanOriginFeat: draft.speciesFeat,
    selectedMusicalInstruments:
      draft.creationData?.selectedMusicalInstruments || [],
    equipmentChoices: [],
    startingInventory: draft.loadout.items.map((item) => ({
      equipmentSlug: item.slug,
      quantity: item.quantity,
      equipped: item.equipped,
    })),
    loadoutResolved: true,
    currency: {
      cp: draft.loadout.currency.cp,
      sp: draft.loadout.currency.sp,
      ep: draft.loadout.currency.ep,
      gp: draft.loadout.currency.gp,
      pp: draft.loadout.currency.pp,
    },
    hpCalculationMethod: draft.creationData?.hpCalculationMethod || 'max',
    spellSelection: {
      selectedCantrips: [...draft.spells.cantrips],
      knownSpells: [...draft.spells.knownOrBook],
      spellbook: [...draft.spells.knownOrBook],
      preparedSpells: [...draft.spells.prepared],
      dailyPrepared: [...draft.spells.prepared],
    },
    knownLanguages: [...draft.languages],
    backgroundTools: [...draft.toolProficiencies],
    personality: draft.personality || '',
    ideals: draft.ideals || '',
    bonds: draft.bonds || '',
    flaws: draft.flaws || '',
  };
}
