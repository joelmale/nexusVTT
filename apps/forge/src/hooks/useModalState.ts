import { useState, useCallback } from 'react';
import { Equipment } from '../types/dnd';

export interface ModalState {
  isOpen: boolean;
  characterId?: string | null;
  characterClass?: string | null;
}

export function useModalState() {
  const [featureModal, setFeatureModal] = useState<{name: string, description: string, source?: string} | null>(null);
  const [equipmentModal, setEquipmentModal] = useState<Equipment | { slug: string } | null>(null);
  const [cantripModalState, setCantripModalState] = useState<ModalState>({ isOpen: false });
  const [subclassModalState, setSubclassModalState] = useState<ModalState>({ isOpen: false });
  const [asiModalState, setAsiModalState] = useState<ModalState>({ isOpen: false });
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const openCantripModal = useCallback((characterId: string, characterClass: string) => {
    setCantripModalState({ isOpen: true, characterId, characterClass });
  }, []);

  const closeCantripModal = useCallback(() => {
    setCantripModalState({ isOpen: false, characterId: null, characterClass: null });
  }, []);

  const openSubclassModal = useCallback((characterId: string, characterClass: string) => {
    setSubclassModalState({ isOpen: true, characterId, characterClass });
  }, []);

  const closeSubclassModal = useCallback(() => {
    setSubclassModalState({ isOpen: false, characterId: null, characterClass: null });
  }, []);

  const openAsiModal = useCallback((characterId: string) => {
    setAsiModalState({ isOpen: true, characterId });
  }, []);

  const closeAsiModal = useCallback(() => {
    setAsiModalState({ isOpen: false, characterId: null });
  }, []);

  return {
    // Modal states
    featureModal,
    equipmentModal,
    cantripModalState,
    subclassModalState,
    asiModalState,
    isWizardOpen,

    // Modal setters
    setFeatureModal,
    setEquipmentModal,
    setIsWizardOpen,

    // Modal actions
    openCantripModal,
    closeCantripModal,
    openSubclassModal,
    closeSubclassModal,
    openAsiModal,
    closeAsiModal,
  };
}