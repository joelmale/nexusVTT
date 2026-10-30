import { CharacterCreationData, Edition } from '../../../types/dnd';
import type { CharacterCreationCompleteHandler } from '../../../api/types';

import type { CreationDraft, CreatorPresentation } from '../../../types/draft';

export interface WizardProps {
  isOpen: boolean;
  edition?: Edition;
  /** Written to `data-theme` on the creator root — the explicit theme boundary. */
  theme?: string;
  /** Overrides the final button label (defaults to "Create Character"). */
  submitLabel?: string;
  /** Initial draft to resume from (CC-501). */
  initialDraft?: CreationDraft;
  initialPresentation?: CreatorPresentation;
  onPresentationChange?: (presentation: CreatorPresentation) => void;
  /** Callback fired when draft updates (CC-501). */
  onDraftChange?: (draft: CreationDraft) => void;
  /** Callback fired when draft is discarded (CC-501). */
  onDraftDiscard?: () => void;
  onCancel: () => void;
  onSwitchToGuided?: () => void;
  /** Show the live character sheet beside the steps. Off by default. */
  showLiveSheet?: boolean;
  /**
   * Receives the finished character. The host owns persistence; throwing or
   * rejecting surfaces the failure in the wizard and keeps it open.
   */
  onComplete: CharacterCreationCompleteHandler;
}

export interface StepProps {
  data: CharacterCreationData;
  updateData: (updates: Partial<CharacterCreationData>) => void;
  nextStep: () => void;
  prevStep: () => void;
  stepIndex: number;
  skipToStep?: (step: number) => void;
  getNextStepLabel?: () => string;
  openTraitModal?: (trait: string, position?: { x: number; y: number }) => void;
}

export interface EquipmentBrowserProps extends StepProps {
  skipToStep: (step: number) => void;
}

export interface WizardContextType {
  currentStep: number;
  creationData: CharacterCreationData;
  updateData: (updates: Partial<CharacterCreationData>) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipToStep: (step: number) => void;
  isLoading: boolean;
  error: string | null;
}
