/**
 * Level-Up Wizard - Overview Step
 *
 * Shows a summary of what's changing at this level
 */

import React from 'react';
import { Character } from '../../../types/dnd';
import { LevelUpData } from '../../../data/classProgression';

interface StepOverviewProps {
  character: Character;
  levelUpData: LevelUpData;
  onNext: () => void;
}

export const StepOverview: React.FC<StepOverviewProps> = ({
  character,
  levelUpData,
  onNext
}) => {
  const { fromLevel, toLevel, averageHpGain, features, choices } = levelUpData;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-accent-gold mb-2">
          Welcome to Level {toLevel}!
        </h3>
        <p className="text-[#992600]">
          {character.name} is about to advance from level {fromLevel} to level {toLevel}.
          Here's what you'll gain:
        </p>
      </div>

      {/* HP Increase */}
      <div className="bg-[#ffcc66] rounded-lg p-4 border border-accent-gold border-opacity-30">
        <h4 className="font-semibold text-accent-gold mb-2 flex items-center">
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z" />
          </svg>
          Hit Points
        </h4>
        <p className="text-theme-text">
          You'll gain approximately {averageHpGain} HP (or you can roll for it).
        </p>
      </div>

      {/* Features Gained */}
      {features.length > 0 && (
        <div className="bg-[#ffcc66] rounded-lg p-4 border border-accent-gold border-opacity-30">
          <h4 className="font-semibold text-accent-gold mb-2 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
            </svg>
            New Features
          </h4>
          <ul className="space-y-2">
            {features.map((feature, index) => (
              <li key={index}>
                <span className="font-semibold text-theme-text">{feature.name}</span>
                {feature.automatic && (
                  <span className="ml-2 text-xs bg-accent-gold bg-opacity-20 text-accent-gold px-2 py-1 rounded">
                    Automatic
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Choices Required */}
      {choices.length > 0 && (
        <div className="bg-[#ffcc66] rounded-lg p-4 border border-accent-gold border-opacity-30">
          <h4 className="font-semibold text-accent-gold mb-2 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            Choices Required
          </h4>
          <p className="text-[#992600] mb-2">
            You'll need to make the following choices:
          </p>
          <ul className="list-disc list-inside space-y-1 text-theme-text">
            {choices.map((choice, index) => (
              <li key={index} className="capitalize">
                {choice.type === 'asi' && 'Ability Score Increase or Feat'}
                {choice.type === 'feat' && 'Feat Selection'}
                {choice.type === 'subclass' && 'Subclass Selection'}
                {choice.type === 'spells' && 'Spell Selection'}
                {choice.type === 'fighting-style' && 'Fighting Style'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Spell Slot Upgrades */}
      {levelUpData.newSpellSlots && (
        <div className="bg-[#ffcc66] rounded-lg p-4 border border-accent-gold border-opacity-30">
          <h4 className="font-semibold text-accent-gold mb-2 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
            </svg>
            Spell Slots
          </h4>
          <p className="text-theme-text">
            Your spell slots have been upgraded!
          </p>
        </div>
      )}

      {/* Next Button */}
      <div className="flex justify-end pt-4">
        <button
          onClick={onNext}
          className="px-6 py-3 bg-[#ffaa00] border bg-accent-gold text-theme-primary font-bold rounded-lg hover:bg-opacity-90 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
};
