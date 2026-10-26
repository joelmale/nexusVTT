/**
 * Public contract for the shared character creation experience.
 *
 * The creator is deliberately persistence-free: it computes a finished
 * character and hands it to the host application, which owns storage,
 * account identity, ownership and any multiplayer concerns.
 */

import type {
  Character as CreatedCharacter,
  CharacterCreationData,
  Edition,
} from '../types/dnd';
import type { CreationDraft, CreatorPresentation } from '../types/draft';
import type { FirstTurnGuidance } from '../services/recommendationService';

export type {
  CreatedCharacter,
  CharacterCreationData,
  Edition,
  CreationDraft,
  FirstTurnGuidance,
};

/**
 * The value handed to `onComplete` when a player finishes the wizard.
 *
 * `character` is the fully calculated sheet in the creator's canonical model.
 * `creationData` is the raw set of wizard answers, retained so hosts can audit
 * or replay a creation without re-deriving choices from the finished sheet.
 * `combatGuidance` provides the first-turn combat card (CC-504).
 */
export interface CharacterCreationResult {
  character: CreatedCharacter;
  creationData: CharacterCreationData;
  edition: Edition;
  createdAt: string;
  combatGuidance?: FirstTurnGuidance;
  creationAttemptId?: string;
  draftId?: string;
  draftRevision?: number;
}

/**
 * Host-supplied completion handler.
 *
 * Returning a rejected promise (or throwing) surfaces the error inside the
 * wizard and keeps it open so the player can retry without losing their work.
 * The wizard stays closed-open under the host's control: it only calls
 * `onCancel`/`onComplete` and never unmounts itself.
 */
export type CharacterCreationCompleteHandler = (
  result: CharacterCreationResult,
) => void | Promise<void>;

export interface CharacterCreatorProps {
  /** Host controls visibility; the creator renders nothing when false. */
  isOpen: boolean;
  /** Ruleset the wizard starts on. Players may still change it on step 0. */
  edition?: Edition;
  /**
   * Explicit theme boundary. The value is written to `data-theme` on the
   * creator's own root element, so host themes never leak in implicitly and
   * the creator's scoped stylesheet never restyles the host.
   */
  theme?: string;
  /** Which flow to open first. Defaults to 'guided'. */
  initialMode?: 'guided' | 'full';
  /** Whether the user can switch between guided flow and full wizard. */
  allowModeSwitch?: boolean;
  /** Initial draft to resume from (CC-501). */
  initialDraft?: CreationDraft;
  initialPresentation?: CreatorPresentation;
  onPresentationChange?: (presentation: CreatorPresentation) => void;
  /** Callback fired whenever the current draft updates (CC-501). */
  onDraftChange?: (draft: CreationDraft) => void;
  /** Callback fired when the player discards or resets a draft (CC-501). */
  onDraftDiscard?: () => void;
  /** Optional label for the final submit button (defaults to "Create Character"). */
  submitLabel?: string;
  /** Called when the player dismisses the wizard without creating anything. */
  onCancel: () => void;
  /** Called with the finished character. May be async; errors are surfaced. */
  onComplete: CharacterCreationCompleteHandler;
}

/** CSS class applied to the creator root; the scoped stylesheet keys off it. */
export const CHARACTER_CREATOR_ROOT_CLASS = 'nexus-character-creator';
