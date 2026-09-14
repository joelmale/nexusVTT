import { createContext } from 'react';
import { Equipment } from '../types/dnd';

type ModalState = {
  isOpen: boolean;
  characterId?: string | null;
  characterClass?: string | null;
};

interface ModalContextType {
  // Modal states
  featureModal: { name: string; description: string; source?: string } | null;
  equipmentModal: Equipment | { slug: string } | null;
  cantripModalState: ModalState;
  subclassModalState: ModalState;
  asiModalState: ModalState;
  isWizardOpen: boolean;

  // Modal setters
  setFeatureModal: React.Dispatch<React.SetStateAction<{ name: string; description: string; source?: string } | null>>;
  setEquipmentModal: React.Dispatch<React.SetStateAction<Equipment | { slug: string } | null>>;
  setIsWizardOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Modal actions
  openCantripModal: (characterId: string, characterClass: string) => void;
  closeCantripModal: () => void;
  openSubclassModal: (characterId: string, characterClass: string) => void;
  closeSubclassModal: () => void;
  openAsiModal: (characterId: string) => void;
  closeAsiModal: () => void;
}

export const ModalContext = createContext<ModalContextType | undefined>(undefined);