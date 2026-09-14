import { useCallback } from 'react';
import { CharacterCreationData } from '../../../types/dnd';
import { getStepTitles } from '../constants/wizard.constants';
import { hasSpellcastingAtLevel } from '../../../utils/spellUtils';
import { calculateFeatAvailability } from '../../../utils/featUtils';

export const useWizardNavigation = (
  currentStep: number,
  setCurrentStep: (step: number) => void,
  creationData: CharacterCreationData
) => {
  const stepTitles = getStepTitles(creationData.edition || '2014');

  const nextStep = useCallback(() => {
    let nextStepIndex = currentStep + 1;

    // Skip conditional steps based on character data
    while (nextStepIndex < stepTitles.length) {
      if (shouldShowStep(nextStepIndex, creationData)) {
        break;
      }
      nextStepIndex++;
    }

    setCurrentStep(Math.min(nextStepIndex, stepTitles.length - 1));
  }, [currentStep, setCurrentStep, creationData, stepTitles]);

  const prevStep = useCallback(() => {
    let prevStepIndex = currentStep - 1;

    // Skip conditional steps going backwards
    while (prevStepIndex >= 0) {
      if (shouldShowStep(prevStepIndex, creationData)) {
        break;
      }
      prevStepIndex--;
    }

    const finalStep = Math.max(prevStepIndex, 0);
    setCurrentStep(finalStep);
  }, [currentStep, setCurrentStep, creationData]);

  const skipToStep = useCallback((step: number) => {
    // Find the next valid step from the target step
    let targetStep = step;
    while (targetStep < stepTitles.length && !shouldShowStep(targetStep, creationData)) {
      targetStep++;
    }

    setCurrentStep(Math.min(Math.max(targetStep, 0), stepTitles.length - 1));
  }, [setCurrentStep, creationData, stepTitles]);

  const getNextStepLabel = useCallback(() => {
    let nextStepIndex = currentStep + 1;

    // Find the next visible step
    while (nextStepIndex < stepTitles.length) {
      if (shouldShowStep(nextStepIndex, creationData)) {
        let label = stepTitles[nextStepIndex].split(':')[0].trim(); // Get the main title

        // Make labels level-aware
        if (label.includes('Class')) { // Generic check for Class step title
          if (creationData.level >= 3) {
            label = 'Choose Class & Subclass';
          } else {
            label = 'Choose Class';
          }
        }

        return label;
      }
      nextStepIndex++;
    }

    return 'Complete';
  }, [currentStep, creationData, stepTitles]);

  return { nextStep, prevStep, skipToStep, getNextStepLabel };
};

// Helper function to determine if a step should be shown
// NOTE: This logic assumes the steps are generally in the same "Content Slots" but shuffled.
// We need to map "Step Index" to "Step Content Type" to be robust if the order changes drastically.
// But for now, 2014 and 2024 have mapped steps.
// 2014: 0=Level, 1=Identity, 2=Species, 3=Class, 4=Abilities...
// 2024: 0=Level, 1=Class, 2=Identity, 3=Species, 4=Abilities...
// The logic below relies on INDEX. This is BROKEN if indices change meaning.
// I need to refactor `shouldShowStep` to rely on the step CONTENT, not index.
// Or I need separate `shouldShowStep2014` and `shouldShowStep2024`.

const shouldShowStep = (stepIndex: number, data: CharacterCreationData): boolean => {
  const edition = data.edition || '2014';
  
  // Define the Logic Map based on Edition
  if (edition === '2024') {
     // 2024 Map:
     // 0: Level
     // 1: Class
     // 2: Identity (Bg)
     // 3: Species
     // 4: Abilities
     // 5: High Level
     // 6: ASI
     // 7: Fighting Style
     // 8: Spells
     // 9: Feats
     // ...
     switch (stepIndex) {
        case 0: return true; // Level
        case 1: return true; // Class
        case 2: return true; // Identity
        case 3: return true; // Species
        case 4: return true; // Abilities
        case 5: return data.level >= 2; // High Level
        case 6: return data.level >= 4; // ASI
        case 7: return ['fighter', 'paladin', 'ranger'].includes(data.classSlug) && data.level >= 2; // Fighting Style
        case 8: return hasSpellcastingAtLevel(data.classSlug, data.level); // Spells
        case 9: return calculateFeatAvailability(data) > 0; // Feats
        default: return true; // Rest are usually always shown
     }
  } else {
     // 2014 Map (Original):
     // 0: Level
     // 1: Identity
     // 2: Species
     // 3: Class
     // 4: Abilities
     // ...
     switch (stepIndex) {
        case 0: return true;
        case 1: return true;
        case 2: return true;
        case 3: return true;
        case 4: return true;
        case 5: return data.level >= 2;
        case 6: return data.level >= 4;
        case 7: return ['fighter', 'paladin', 'ranger'].includes(data.classSlug) && data.level >= 2;
        case 8: return hasSpellcastingAtLevel(data.classSlug, data.level);
        case 9: return calculateFeatAvailability(data) > 0;
        default: return true;
     }
  }
};