import React from 'react';
import { Dice6 } from 'lucide-react';

interface WizardHeaderProps {
  currentStep: number;
  stepTitles: string[];
  onClose: () => void;
}

export const WizardHeader: React.FC<WizardHeaderProps> = ({ currentStep, stepTitles, onClose }) => {
  const title = stepTitles?.[currentStep] || 'Character Creation';
  return (
    <div className="flex justify-between items-center border-b border-accent-red-dark pb-3">
      <h2 className="text-2xl font-bold text-red-500 flex items-center">
        <Dice6 className="w-6 h-6 mr-2" /> {title}
      </h2>
      <button onClick={onClose} className="text-theme-muted hover:text-white text-xl font-bold">&times;</button>
    </div>
  );
};