import React from 'react';
import {
  sectionForStep,
  visibleSections,
} from '../constants/creationSections';

interface WizardProgressBarProps {
  currentStep: number;
  stepTitles: string[];
  /**
   * Indices of the steps this character will actually be asked. Most of the
   * fourteen are conditional, so counting all of them tells a level-1 Fighter
   * they have twelve steps of work left when they have seven.
   */
  visibleStepIndices?: number[];
}

export const WizardProgressBar: React.FC<WizardProgressBarProps> = ({
  currentStep,
  stepTitles,
  visibleStepIndices,
}) => {
  const visible =
    visibleStepIndices && visibleStepIndices.length > 0
      ? visibleStepIndices
      : stepTitles.map((_, index) => index);

  // Steps are skipped, not renumbered, so the position is how many counted
  // steps are at or before the current one. A step left out of the count (the
  // Feats step) therefore reads as the step just before it.
  const totalSteps = visible.length || 1;
  const displayPosition = Math.min(
    Math.max(visible.filter((index) => index <= currentStep).length, 1),
    totalSteps,
  );

  const sections = visibleSections(visible);
  const currentSection = sectionForStep(currentStep)?.id;

  return (
    <div className='mt-4'>
      <ol
        aria-label='Sections'
        className='flex flex-wrap gap-x-4 gap-y-1 mb-2 text-sm'
      >
        {sections.map((section) => (
          <li
            key={section.id}
            aria-current={section.id === currentSection ? 'step' : undefined}
            className={
              section.id === currentSection
                ? 'font-bold text-theme-primary'
                : 'text-theme-muted'
            }
          >
            {section.label}
          </li>
        ))}
      </ol>
      <div className='h-2 bg-theme-tertiary rounded-full overflow-hidden'>
        <div
          className='h-full bg-accent-red transition-all duration-500'
          style={{ width: `${(displayPosition / totalSteps) * 100}%` }}
        />
      </div>
      <p className='text-center text-sm text-theme-muted mt-2'>
        Step {displayPosition} of {totalSteps}
      </p>
    </div>
  );
};
