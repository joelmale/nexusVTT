import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { WizardProps } from './types/wizard.types';
import { useWizardState, useWizardNavigation } from './hooks';
import { WizardHeader, WizardProgressBar, WizardStepContainer } from './components';
import { getStepTitles } from './constants/wizard.constants';
import { getAllSpecies } from '../../services/dataService';
import SpeciesTraitModal from '../SpeciesTraitModal';
import {
  Step0Level,
  Step1Details,
  Step2Species,
  Step3Class,
  Step3point5FightingStyle,
  Step4Spells,
  Step4Abilities,
  Step5point5Feats,
  Step6Equipment,
  Step7EquipmentBrowser,
  Step8Traits,
  Step9Languages
} from './steps';
import { StepHighLevelSetup } from './steps/StepHighLevelSetup';
import { StepCumulativeASI } from './steps/StepCumulativeASI';

export const CharacterCreationWizard: React.FC<WizardProps> = ({
  isOpen,
  edition,
  onClose,
  onCharacterCreated
}) => {
  const {
    currentStep,
    setCurrentStep,
    creationData,
    updateData,
    resetWizard,
    error,
    setError
  } = useWizardState();

  const { nextStep, prevStep, skipToStep, getNextStepLabel } = useWizardNavigation(currentStep, setCurrentStep, creationData);
  
  // Get dynamic step titles based on edition
  const stepTitles = getStepTitles(creationData.edition || edition || '2014');

  // Reset wizard when it opens
  useEffect(() => {
    if (isOpen) {
      resetWizard({ edition });
    }
  }, [isOpen, resetWizard, edition]);

  // Racial trait modal state
  const [selectedTrait, setSelectedTrait] = useState<string | null>(null);
  const [showTraitModal, setShowTraitModal] = useState(false);
  const [modalPosition, setModalPosition] = useState<{ x: number; y: number } | null>(null);

  const openTraitModal = (trait: string, position?: { x: number; y: number }) => {
    setSelectedTrait(trait);
    setModalPosition(position || null);
    setShowTraitModal(true);
  };

  const closeTraitModal = () => {
    setShowTraitModal(false);
    setSelectedTrait(null);
  };

  if (!isOpen) return null;

  const handleSubmit = async (data: typeof creationData) => {
    try {
      // Clear any previous errors
      setError(null);

      // Import required functions
      const { calculateCharacterStats } = await import('../../utils/characterCreationUtils');
      const { addCharacter } = await import('../../services/dbService');
      const { generateUUID } = await import('../../services/diceService');

      // Convert creation data to full character object
      const character = calculateCharacterStats(data);

      // Add unique ID
      const characterWithId = {
        ...character,
        id: generateUUID()
      };

      // Save to database
      await addCharacter(characterWithId);

      // Notify parent component to refresh character list
      onCharacterCreated();

      // Reset wizard state for next use
      resetWizard({ edition });

      // Close wizard
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An unexpected error occurred while creating the character.');
    }
  };

  const renderStep = () => {
    const commonProps = { data: creationData, updateData, nextStep, prevStep, stepIndex: currentStep, getNextStepLabel, openTraitModal };

    // Dynamic Step Rendering based on Edition
    // 2024 Order: Level -> Class -> Identity -> Species -> Abilities...
    // 2014 Order: Level -> Identity -> Species -> Class -> Abilities...
    
    if (creationData.edition === '2024') {
      switch (currentStep) {
        case 0: return <Step0Level {...commonProps} />;
        case 1: return <Step1Details {...commonProps} />; // Basic Identity first
        case 2: return <Step2Species {...commonProps} />; // Species second
        case 3: return <Step3Class {...commonProps} />; // Class third
        case 4: return <Step4Abilities {...commonProps} />;
        case 5: return <StepHighLevelSetup {...commonProps} />;
        case 6: return <StepCumulativeASI {...commonProps} />;
        case 7: return <Step3point5FightingStyle {...commonProps} />;
        case 8: return <Step4Spells {...commonProps} />;
        case 9: return <Step5point5Feats {...commonProps} />;
        case 10: return <Step9Languages {...commonProps} />;
        case 11: return <Step6Equipment {...commonProps} skipToStep={skipToStep} />;
        case 12: return <Step7EquipmentBrowser {...commonProps} skipToStep={skipToStep} />;
        case 13: return <Step8Traits {...commonProps} onSubmit={() => handleSubmit(creationData)} />;
        default: return <div>Unknown step</div>;
      }
    } else {
      // Legacy 2014 Order
      switch (currentStep) {
        case 0: return <Step0Level {...commonProps} />;
        case 1: return <Step1Details {...commonProps} />;
        case 2: return <Step2Species {...commonProps} />;
        case 3: return <Step3Class {...commonProps} />;
        case 4: return <Step4Abilities {...commonProps} />;
        case 5: return <StepHighLevelSetup {...commonProps} />;
        case 6: return <StepCumulativeASI {...commonProps} />;
        case 7: return <Step3point5FightingStyle {...commonProps} />;
        case 8: return <Step4Spells {...commonProps} />;
        case 9: return <Step5point5Feats {...commonProps} />;
        case 10: return <Step9Languages {...commonProps} />;
        case 11: return <Step6Equipment {...commonProps} skipToStep={skipToStep} />;
        case 12: return <Step7EquipmentBrowser {...commonProps} skipToStep={skipToStep} />;
        case 13: return <Step8Traits {...commonProps} onSubmit={() => handleSubmit(creationData)} />;
        default: return <div>Unknown step</div>;
      }
    }
  };

  return createPortal(
    <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-theme-secondary rounded-2xl shadow-2xl w-full max-w-5xl transition-all transform duration-300 scale-100 my-8 flex flex-col max-h-[calc(100vh-4rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <div className="flex-shrink-0 p-6 md:p-8 pb-4">
          <WizardHeader currentStep={currentStep} stepTitles={stepTitles} onClose={onClose} />
          <WizardProgressBar currentStep={currentStep} stepTitles={stepTitles} />
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex-shrink-0 mx-6 md:mx-8 mb-4">
            <div className="bg-red-900 border border-accent-red-dark rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-accent-red-light" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-200">
                    Character Creation Error
                  </h3>
                  <div className="mt-2 text-sm text-red-300">
                    <p>{error}</p>
                  </div>
                </div>
                <div className="ml-auto pl-3">
                  <button
                    onClick={() => setError(null)}
                    className="inline-flex rounded-md bg-red-900 p-1.5 text-accent-red-light hover:bg-accent-red-darker focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2"
                  >
                    <span className="sr-only">Dismiss</span>
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Content */}
        <WizardStepContainer>
          {/* Wizard Content */}
          {renderStep()}
        </WizardStepContainer>
      </div>

      {/* Species Trait Modal */}
      {selectedTrait && (
        <SpeciesTraitModal
          isOpen={showTraitModal}
          onClose={closeTraitModal}
          traitName={selectedTrait}
          speciesName={creationData.speciesSlug ? getAllSpecies().find(s => s.slug === creationData.speciesSlug)?.name || 'Unknown Species' : 'Unknown Species'}
          position={modalPosition}
        />
      )}
    </div>,
    document.body
  );
};