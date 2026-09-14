import { CharacterCreationData, Edition } from '../../../types/dnd';

export interface WizardProps {
  isOpen: boolean;
  edition: Edition;
  onClose: () => void;
  onCharacterCreated: () => void;
  setRollResult: (result: { text: string; value: number | null }) => void;
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