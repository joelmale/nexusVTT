import React, { useState } from 'react';
import { X, FileText, Wand2, User, BookOpen, Sparkles } from 'lucide-react';
import { Edition } from '../types/dnd';

interface NewCharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectManualEntry: (edition: Edition) => void;
  onSelectWizard: (edition: Edition) => void;
  onSelectPersonality: (edition: Edition) => void;
}

const NewCharacterModal: React.FC<NewCharacterModalProps> = ({
  isOpen,
  onClose,
  onSelectManualEntry,
  onSelectWizard,
  onSelectPersonality
}) => {
  const [edition, setEdition] = useState<Edition>('2024');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-[60] p-4">
      <div className="bg-theme-secondary border border-theme-primary rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-theme-primary">
          <h2 className="text-2xl font-bold text-accent-yellow-light">Create New Character</h2>
          <button
            onClick={onClose}
            className="text-theme-muted hover:text-theme-primary transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Ruleset Selection */}
          <div className="mb-8 bg-theme-tertiary/30 p-4 rounded-lg border border-theme-primary">
            <h3 className="text-lg font-semibold text-theme-tertiary mb-3 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-accent-blue-light" />
              Select Ruleset
            </h3>
            <div className="flex gap-4">
              <button
                onClick={() => setEdition('2014')}
                className={`flex-1 p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                  edition === '2014'
                    ? 'bg-theme-tertiary border-accent-yellow-light shadow-lg'
                    : 'bg-theme-secondary border-theme-primary hover:bg-theme-tertiary opacity-70 hover:opacity-100'
                }`}
              >
                <span className={`font-bold ${edition === '2014' ? 'text-accent-yellow-light' : 'text-theme-muted'}`}>Legacy (2014)</span>
                <span className="text-xs text-theme-muted text-center">Original 5th Edition Rules</span>
              </button>
              <button
                onClick={() => setEdition('2024')}
                className={`flex-1 p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                  edition === '2024'
                    ? 'bg-theme-tertiary border-accent-green-light shadow-lg'
                    : 'bg-theme-secondary border-theme-primary hover:bg-theme-tertiary opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className={`font-bold ${edition === '2024' ? 'text-accent-green-light' : 'text-theme-muted'}`}>Revised (2024)</span>
                  <Sparkles className={`w-3 h-3 ${edition === '2024' ? 'text-accent-green-light' : 'text-theme-muted'}`} />
                </div>
                <span className="text-xs text-theme-muted text-center">Updated Core Rules & Mechanics</span>
              </button>
            </div>
          </div>

          <p className="text-theme-tertiary mb-6 text-center">
            Choose how you'd like to create your new character. Each method offers a different approach to bringing your hero to life.
          </p>

          {/* Options Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Manual Entry Option */}
            <button
              onClick={() => onSelectManualEntry(edition)}
              className="p-4 bg-theme-tertiary hover:bg-theme-quaternary rounded-lg border-2 border-theme-primary hover:border-blue-500 transition-all text-left group"
            >
              <div className="flex items-center mb-3">
                <FileText className="w-6 h-6 text-accent-blue-light mr-2 group-hover:text-blue-300" />
                <h3 className="text-lg font-semibold text-blue-300">Manual Entry</h3>
              </div>
               <p className="text-sm text-theme-tertiary leading-relaxed">
                 Transfer a pen & paper character or fill out a complete character sheet manually.
               </p>
            </button>

            {/* Character Wizard Option */}
            <button
              onClick={() => onSelectWizard(edition)}
              className="p-4 bg-theme-tertiary hover:bg-theme-quaternary rounded-lg border-2 border-theme-primary hover:border-green-500 transition-all text-left group"
            >
              <div className="flex items-center mb-3">
                <Wand2 className="w-6 h-6 text-accent-green-light mr-2 group-hover:text-green-300" />
                <h3 className="text-lg font-semibold text-green-300">Character Wizard</h3>
              </div>
              <p className="text-sm text-theme-tertiary leading-relaxed">
                Guided step-by-step character creation with detailed options and recommendations.
              </p>
              <div className="mt-3 text-xs text-accent-green-light">
                Recommended for new players
              </div>
            </button>

            {/* Personality Wizard Option */}
            <button
              onClick={() => onSelectPersonality(edition)}
              className="p-4 bg-theme-tertiary hover:bg-theme-quaternary rounded-lg border-2 border-theme-primary hover:border-accent-purple transition-all text-left group"
            >
              <div className="flex items-center mb-3">
                <User className="w-6 h-6 text-accent-purple-light mr-2 group-hover:text-purple-300" />
                <h3 className="text-lg font-semibold text-purple-300">Personality Wizard</h3>
              </div>
              <p className="text-sm text-theme-tertiary leading-relaxed">
                Create a character based on personality and playstyle preferences.
              </p>
              <div className="mt-3 text-xs text-accent-purple-light">
                Quick & intuitive
              </div>
            </button>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-theme-primary text-center">
            <p className="text-xs text-theme-disabled">
              Don't worry - you can always change your mind and try a different method later!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewCharacterModal;