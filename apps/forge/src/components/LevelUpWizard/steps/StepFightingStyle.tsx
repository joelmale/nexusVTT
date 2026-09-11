/**
 * Level-Up Wizard - Fighting Style Step
 *
 * Choose a fighting style (Fighter, Paladin, Ranger)
 */

import React, { useState } from 'react';
import { Character, LevelUpChoices } from '../../../types/dnd';
import { LevelUpData } from '../../../data/classProgression';
import { FIGHTING_STYLES } from '../../../services/dataService';

interface StepFightingStyleProps {
  character: Character;
  levelUpData: LevelUpData;
  choices: LevelUpChoices;
  updateChoices: (choices: Partial<LevelUpChoices>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export const StepFightingStyle: React.FC<StepFightingStyleProps> = ({
  character: _character,
  levelUpData: _levelUpData,
  choices: _choices,
  updateChoices,
  onNext,
  onPrev
}) => {
  const [selectedStyle, setSelectedStyle] = useState<string>('');

  const fightingStyles = FIGHTING_STYLES;

  const handleNext = () => {
    updateChoices({ fightingStyleChosen: selectedStyle });
    onNext();
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-accent-gold mb-2">
          Choose Fighting Style
        </h3>
        <p className="text-[#992600]">
          Select a fighting style to specialize your combat abilities.
        </p>
      </div>

      <div className="max-h-96 overflow-y-auto space-y-3">
        {fightingStyles.map((style) => (
          <button
            key={style.slug}
            onClick={() => setSelectedStyle(style.slug)}
            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
              selectedStyle === style.slug
                ? 'border-accent-gold bg-accent-gold bg-opacity-10'
                : 'border-theme-border bg-theme-primary hover:border-accent-gold hover:border-opacity-50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-semibold text-accent-gold mb-1">{style.name}</h4>
                <p className="text-sm text-[#992600]">{style.description}</p>
                {style.prerequisite && style.prerequisite !== 'None' && (
                  <p className="text-xs text-[#992600] mt-2">
                    Prerequisite: {style.prerequisite}
                  </p>
                )}
              </div>
              <div className={`flex-shrink-0 ml-4 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                selectedStyle === style.slug ? 'border-accent-gold bg-accent-gold' : 'border-theme-border'
              }`}>
                {selectedStyle === style.slug && (
                  <svg className="w-3 h-3 text-theme-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <button
          onClick={onPrev}
          className="px-6 py-3 bg-theme-primary text-theme-text font-semibold rounded-lg hover:bg-opacity-80 transition-colors border border-theme-border"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={!selectedStyle}
          className="px-6 py-3 bg-[#ffaa00] border bg-accent-gold text-theme-primary font-semibold rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
};
