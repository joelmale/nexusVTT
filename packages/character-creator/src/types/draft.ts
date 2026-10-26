import { AbilityName, Character, CharacterCreationData } from './dnd';

export type DraftProvenance = 'player' | 'recommended' | 'imported';

export interface DraftChoiceRecord<T = unknown> {
  value: T;
  provenance: DraftProvenance;
  updatedAt: string;
  sourceKey?: string;
}

export interface ResolvedEquipmentItem {
  id: string;
  slug: string;
  name: string;
  quantity: number;
  equipped: boolean;
  slot?: 'armor' | 'shield' | 'main_hand' | 'off_hand' | 'two_handed';
  ac?: number;
  armorType?: 'light' | 'medium' | 'heavy' | 'shield';
  stealthDisadvantage?: boolean;
  source: 'class' | 'background' | 'purchased' | 'custom';
}

export interface ResolvedCurrency {
  cp: number;
  sp: number;
  ep: number;
  gp: number;
  pp: number;
}

export interface ResolvedLoadout {
  items: ResolvedEquipmentItem[];
  currency: ResolvedCurrency;
  totalValueGp: number;
}

export interface DraftIssue {
  id: string;
  step: number;
  group:
    | 'species'
    | 'class'
    | 'background'
    | 'abilities'
    | 'spells'
    | 'equipment'
    | 'finalization';
  severity: 'error' | 'warning' | 'info';
  message: string;
  repairTarget?: string;
}

/**
 * Versioned canonical creation draft (CC-003 / CC-201)
 * Decouples raw player/rules choices from presentation state.
 */
export interface CreationDraft {
  draftVersion: 1;
  /** Additive v1 fields; old drafts acquire these when adapted. */
  revision?: number;
  attemptId?: string;
  /** Complete legacy answers, including high-level and optional choices. */
  creationData?: CharacterCreationData;
  allowedSources?: string[];
  draftId: string;
  characterId: string;
  edition: '2014' | '2024';
  level: number;
  name: string;

  // Base facts & core selections
  speciesSlug?: string;
  lineageSlug?: string;
  classSlug?: string;
  subclassSlug?: string;
  backgroundSlug?: string;

  // Raw base ability scores (before background, feat, or species modifiers)
  rawAbilityScores: Record<AbilityName, number>;
  abilityMethod: 'standard' | 'point-buy' | 'manual' | 'preset';

  // Background ASI (2024) or Species ASI (2014)
  abilityBonuses: {
    method?: '2/1' | '1/1/1';
    bonuses: Partial<Record<AbilityName, number>>;
  };

  // Explicit grants and entitlements
  skills: string[];
  expertise: string[];
  fightingStyle?: string;
  weaponMastery?: string[];
  originFeat?: string;
  speciesFeat?: string;
  languages: string[];
  toolProficiencies: string[];

  // Spells
  spells: {
    cantrips: string[];
    knownOrBook: string[];
    prepared: string[];
  };

  // Resolved loadout
  loadout: ResolvedLoadout;

  // Metadata & Narrative
  alignment?: string;
  personality?: string;
  ideals?: string;
  bonds?: string;
  flaws?: string;
  notes?: string;

  // Choice provenance tracking
  provenance: Record<string, DraftProvenance>;
}

/**
 * Result of the evaluation facade (CC-003 / CC-204)
 */
export interface DraftEvaluationResult {
  draft: CreationDraft;
  /** Missing while required catalog choices cannot be evaluated. */
  calculatedCharacter?: Character;
  issues: DraftIssue[];
  isValid: boolean;
  evaluatedAt: string;
  evaluatorVersion: string;
  draftRevision?: number;
  draftFingerprint?: string;
}

export interface CreatorPresentation {
  mode: 'guided' | 'full';
  guidedFlow?: 'four-screen' | 'quiz';
  step?: number;
  positions?: { full?: number; fourScreen?: number; quiz?: number };
}
