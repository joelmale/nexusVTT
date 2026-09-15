/**
 * @nexus/character-creator
 *
 * The single maintained D&D 5e character creation experience, shared by
 * Nexus Forge and Nexus VTT. The package owns the wizard UI plus the rules
 * data and calculators it needs; it owns no persistence, account identity or
 * multiplayer state. Hosts receive a `CharacterCreationResult` and decide what
 * to do with it.
 */

export { CharacterCreationWizard } from './components/CharacterCreationWizard';
export { CharacterCreationWizard as CharacterCreator } from './components/CharacterCreationWizard';

export {
  CHARACTER_CREATOR_ROOT_CLASS,
  type CharacterCreationResult,
  type CharacterCreationCompleteHandler,
  type CharacterCreatorProps,
  type CreatedCharacter,
  type CharacterCreationData,
  type Edition,
} from './api/types';

// The completion handshake, exported so hosts can unit-test their own
// persistence against the same contract the wizard uses.
export { useCreationSubmission } from './components/CharacterCreationWizard/hooks/useCreationSubmission';

export type {
  WizardProps,
  StepProps,
  EquipmentBrowserProps,
} from './components/CharacterCreationWizard/types/wizard.types';

// Rules surface reused by host applications (character sheets, level-up, etc.)
export * from './types/dnd';
export { calculateCharacterStats } from './utils/characterCreationUtils';

// Model conversion for hosts that persist the shared `@nexus/character-contracts`
// character shape (Nexus VTT). One implementation serves both the live creator
// and Forge JSON imports.
export {
  toNexusCharacter,
  createdCharacterToNexus,
  resolveProficientSaves,
  normalizeSkillKey,
  UNMAPPED_CREATOR_FIELDS,
  type ToNexusCharacterOptions,
} from './adapters/nexusCharacter';
