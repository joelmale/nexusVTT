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
    setCreationData({ ...initialCreationData, ...initialData });
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