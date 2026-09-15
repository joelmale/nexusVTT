import React from 'react';

interface WizardStepContainerProps {
  children: React.ReactNode;
}

export const WizardStepContainer: React.FC<WizardStepContainerProps> = ({ children }) => {
  return (
    <div className="flex-1 overflow-y-auto px-6 md:px-8 pb-6 md:pb-8">
      {children}
    </div>
  );
};