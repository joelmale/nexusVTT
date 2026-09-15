import { useState, useCallback } from 'react';
import { CharacterCreationData } from '../../../types/dnd';
import { initialCreationData } from '../constants/wizard.constants';

export const useWizardState = () => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [creationData, setCreationData] = useState<CharacterCreationData>(initialCreationData);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const updateData = useCallback((updates: Partial<CharacterCreationData>) => {
    setCreationData(prev => ({ ...prev, ...updates }));
  }, []);

  const resetWizard = useCallback((initialData?: Partial<CharacterCreationData>) => {
    setCurrentStep(0);
    // Drop undefined entries so an omitted optional prop (e.g. a host that does
    // not pin an edition) falls back to the configured default rather than
    // overwriting it with undefined.
    const provided = Object.fromEntries(
      Object.entries(initialData ?? {}).filter(([, value]) => value !== undefined)
    ) as Partial<CharacterCreationData>;
    setCreationData({ ...initialCreationData, ...provided });
    setIsLoading(false);
    setError(null);
  }, []);

  return {
    currentStep,
    setCurrentStep,
    creationData,
    updateData,
    resetWizard,
    isLoading,
    setIsLoading,
    error,
    setError
  };
};