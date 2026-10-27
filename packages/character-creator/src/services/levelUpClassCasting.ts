import type {
  Character,
  CharacterCreationData,
  LevelUpChoices,
} from '../types/dnd';

/** Class-grant selection facts only; this is not an input for rebuilding a character. */
export function levelUpClassCastingData(
  character: Character,
  choices: LevelUpChoices = {},
): CharacterCreationData {
  return {
    name: character.name,
    edition: character.edition,
    level: character.level + 1,
    classSlug: character.classSlug || character.class.toLowerCase(),
    speciesSlug: character.species,
    abilities: {
      STR: character.abilities.STR.score,
      DEX: character.abilities.DEX.score,
      CON: character.abilities.CON.score,
      INT: character.abilities.INT.score,
      WIS: character.abilities.WIS.score,
      CHA: character.abilities.CHA.score,
    },
    abilityScoreMethod: 'custom',
    background: character.background,
    alignment: character.alignment,
    selectedSkills: [],
    selectedMusicalInstruments: [],
    equipmentChoices: [],
    hpCalculationMethod: 'max',
    personality: '',
    ideals: '',
    bonds: '',
    flaws: '',
    spellSelection: {
      selectedCantrips: [
        ...(character.spellcasting?.cantripsKnown ?? []),
        ...(choices.cantripsLearned ?? []),
      ],
      spellbook: [
        ...(character.spellcasting?.spellbook ?? []),
        ...(choices.spellsLearned ?? []),
      ],
    },
    additionalCastingSources:
      choices.castingSourcesChosen ?? character.castingSources,
  };
}
