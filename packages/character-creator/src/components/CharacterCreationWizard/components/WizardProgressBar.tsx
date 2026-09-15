import React from 'react';

interface WizardProgressBarProps {
  currentStep: number;
  stepTitles: string[];
}

export const WizardProgressBar: React.FC<WizardProgressBarProps> = ({ currentStep, stepTitles }) => {
  const totalSteps = stepTitles?.length || 1;
  return (
    <div className='mt-4'>
      <div className='h-2 bg-theme-tertiary rounded-full overflow-hidden'>
        <div
          className='h-full bg-accent-red transition-all duration-500'
          style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
        />
      </div>
      <p className='text-center text-sm text-theme-muted mt-2'>Step {currentStep + 1} of {totalSteps}</p>
    </div>
  );
};