import { CharacterCreationData, Edition } from '../../../types/dnd';
import type { CharacterCreationCompleteHandler } from '../../../api/types';

export interface WizardProps {
  isOpen: boolean;
  edition?: Edition;
  /** Written to `data-theme` on the creator root — the explicit theme boundary. */
  theme?: string;
  /** Overrides the final button label (defaults to "Create Character"). */
  submitLabel?: string;
  onCancel: () => void;
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
