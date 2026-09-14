import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface WizardNavigationProps {
  onPrevStep: () => void;
  onNextStep: () => void;
  canGoNext: boolean;
  nextButtonText?: string;
}

export const WizardNavigation: React.FC<WizardNavigationProps> = ({
  onPrevStep,
  onNextStep,
  canGoNext,
  nextButtonText = 'Next'
}) => {
  return (
    <div className='flex justify-between'>
      <button
        onClick={onPrevStep}
        className="px-4 py-2 bg-theme-quaternary hover:bg-theme-hover rounded-lg text-white flex items-center"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Back
      </button>
      <button
        onClick={onNextStep}
        disabled={!canGoNext}
        className="px-4 py-2 bg-accent-red hover:bg-accent-red-light rounded-lg text-white flex items-center disabled:bg-theme-quaternary disabled:cursor-not-allowed"
      >
        {nextButtonText} <ArrowRight className="w-4 h-4 ml-2" />
      </button>
    </div>
  );
};