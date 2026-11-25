/**
 * @nexus/character-creator
 *
 * The single maintained D&D 5e character creation experience, shared by
 * Nexus Forge and Nexus VTT. The package owns the wizard UI plus the rules
 * data and calculators it needs; it owns no persistence, account identity or
 * multiplayer state. Hosts receive a `CharacterCreationResult` and decide what
 * to do with it.
 */

// The host-facing entry point: opens the single creator and lets the
// player switch to the full wizard without losing the session.
export { CharacterCreator } from './components/CharacterCreator';
export type {
  CharacterCreatorProps as CharacterCreatorComponentProps,
  CreationMode,
} from './components/CharacterCreator';

// The individual doors, for hosts that present their own chooser.
export { CharacterCreationWizard } from './components/CharacterCreationWizard';

export {
  CHARACTER_CREATOR_ROOT_CLASS,
  type CharacterCreationResult,
  type CharacterCreationCompleteHandler,
  type CharacterCreatorProps,
  type CreatedCharacter,
  type CharacterCreationData,
  type Edition,
} from './api/types';

export { resolveRequestedEdition } from './api/edition';
export { resolveCreatorTheme, type CreatorTheme } from './api/theme';
export { mergeEquipmentCatalog } from './services/equipmentCatalog';

// The completion handshake, exported so hosts can unit-test their own
// persistence against the same contract the wizard uses.
export { isPristineDraft } from './adapters/draftAdapter';
export {
  useCreatorRecovery,
  type CreatorDraftRepository,
} from './hooks/useCreatorRecovery';
export { useCreationSubmission } from './components/CharacterCreationWizard/hooks/useCreationSubmission';

export type {
  WizardProps,
  StepProps,
  EquipmentBrowserProps,
} from './components/CharacterCreationWizard/types/wizard.types';

// Rules surface reused by host applications (character sheets, level-up, etc.)
export * from './types/dnd';
export {
  featSpellChoiceFields,
  featSpellChoicesComplete,
  resolveFeatSpellChoice,
  type FeatSpellChoiceField,
} from './services/featSpellChoices';
export type { CharacterCastingSource as CreatorCastingSource } from '@nexus/character-contracts';
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

// Procedural NPC generator for Campaign Studio, VTT, and Forge
export {
  generateRandomNpc,
  STAT_BLOCK_PRESETS,
  COMMON_OCCUPATIONS,
  COMMON_RACES,
  COMMON_ANCESTRIES,
  DEFAULT_MOTIVATIONS,
  DEFAULT_RELATIONSHIPS,
  type GeneratedNpc,
  type NpcGeneratorOptions,
  type NpcCombatSummary,
  type NpcStatBlockRef,
} from './generators/npcGenerator';

// Procedural Faction and Relationship Web generator for Campaign Studio, VTT, and Forge
export {
  generateSingleFaction,
  generateFactionWeb,
  generateKeyFigure,
  type FactionRelationshipType,
  type FactionRelationship,
  type GeneratedKeyFigure,
  type GeneratedFaction,
  type CentralFlashpoint,
  type FactionWebResult,
  type FactionGeneratorOptions,
} from './generators/factionGenerator';
export {
  type CreationDraft,
  type DraftIssue,
  type DraftEvaluationResult,
  type ResolvedLoadout,
  type ResolvedEquipmentItem,
  type ResolvedCurrency,
  type DraftProvenance,
  type CreatorPresentation,
} from './types/draft';

export {
  creationDataToDraft,
  draftToCreationData,
  type DraftAdapterOptions,
} from './adapters/draftAdapter';

export {
  resolveCatalogEntitlements,
  type CatalogValidationOptions,
} from './services/catalogResolver';

export {
  resolveLoadout,
  calculateTotalCurrencyGp,
} from './services/loadoutResolver';

export {
  evaluateDraft,
  toCharacterCreationResult,
} from './services/draftEvaluator';

export {
  getRecommendation,
  intentToClass,
  type CombatIntent,
  type RecommendationRequest,
  type RecommendationResult,
  type FirstTurnGuidance,
} from './services/recommendationService';

export {
  CERTIFIED_SUPPORT_MANIFEST,
  type ClassSupportCertification,
} from './data/supportManifest';

export {
  createDraftStorageKey,
  saveDraftToStorage,
  loadDraftFromStorage,
  clearDraftFromStorage,
  migrateDraft,
  CURRENT_DRAFT_VERSION,
  encodeDraftRecord,
  decodeDraftRecord,
  type DraftRecordInput,
  type DecodedDraftRecord,
  type DurableDraftRecord,
  type LoadDraftResult,
} from './services/draftStorage';

export {
  studyRecorder,
  type StudyEvent,
  type StudyEventType,
  type StudySessionMetrics,
} from './services/studyRecorder';

export { generateFirstTurnGuidance } from './services/guidanceService';
export { LevelUpExpertiseChoices } from './components/LevelUpExpertiseChoices';
export { LevelUpInvocationChoices } from './components/LevelUpInvocationChoices';
export { LevelUpWeaponMasteryChoices } from './components/LevelUpWeaponMasteryChoices';
export { LevelUpClassCastingChoices } from './components/LevelUpClassCastingChoices';
export {
  ClassResourceControls,
  type ClassResourceControlsProps,
} from './components/ClassResourceControls';
