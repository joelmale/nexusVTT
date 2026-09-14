import { CharacterCreationData, Edition } from '../../../types/dnd';

import wizardConfig from '../../../data/wizardConfig.json';

export const STEP_TITLES_2014 = [
  "Character Level",
  "Basic Identity",
  "Choose Species",
  "Choose Class & Subclass",
  "Determine Abilities",
  "High-Level Setup",
  "Ability Score Improvements",
  "Choose Fighting Style",
  "Select Spells",
  "Choose Feats",
  "Select Languages",
  "Select Equipment",
  "Customize Equipment",
  "Final Details & Personality"
];

// 2024 Order: Background -> Species -> Class -> Abilities
export const STEP_TITLES_2024 = [
  "Character Level",
  "Basic Identity (Background)",
  "Choose Species",
  "Choose Class & Subclass",
  "Determine Abilities",
  "High-Level Setup",
  "Ability Score Improvements",
  "Choose Fighting Style",
  "Select Spells",
  "Choose Feats",
  "Select Languages",
  "Select Equipment",
  "Customize Equipment",
  "Final Details & Personality"
];

export const getStepTitles = (edition: Edition) => edition === '2024' ? STEP_TITLES_2024 : STEP_TITLES_2014;

export const initialCreationData: CharacterCreationData = wizardConfig.initialCreationData as CharacterCreationData;