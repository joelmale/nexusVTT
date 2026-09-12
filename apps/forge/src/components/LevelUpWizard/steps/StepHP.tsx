/**
 * Level-Up Wizard - HP Step
 *
 * Choose to roll for HP or take the average
 */

import React, { useState } from 'react';
import { Character, LevelUpChoices } from '../../../types/dnd';
import { LevelUpData } from '../../../data/classProgression';
import { rollHitPoints } from '../../../utils/levelUpUtils';

interface StepHPProps {
  character: Character;
  levelUpData: LevelUpData;
  choices: LevelUpChoices;
  updateChoices: (choices: Partial<LevelUpChoices>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export const StepHP: React.FC<StepHPProps> = ({
  character,
  levelUpData,
  choices: _choices,
  updateChoices,
  onNext,
  onPrev
}) => {
  const { hitDie, conModifier, averageHpGain } = levelUpData;
  const [hpMethod, setHpMethod] = useState<'average' | 'roll'>('average');
  const [rolledHP, setRolledHP] = useState<number | null>(null);

  const handleRollHP = () => {
    const rolled = rollHitPoints(hitDie, conModifier);
    setRolledHP(rolled);
    updateChoices({ hpGained: rolled, hpRoll: rolled });
  };

  const handleSelectAverage = () => {
    setHpMethod('average');
    setRolledHP(null);
    updateChoices({ hpGained: averageHpGain, hpRoll: undefined });
  };

  const handleSelectRoll = () => {
    setHpMethod('roll');
    if (rolledHP === null) {
      handleRollHP();
    } else {
      updateChoices({ hpGained: rolledHP, hpRoll: rolledHP });
    }
  };

  const handleNext = () => {
    if (hpMethod === 'average') {
      updateChoices({ hpGained: averageHpGain, hpRoll: undefined });
    } else if (rolledHP !== null) {
      updateChoices({ hpGained: rolledHP, hpRoll: rolledHP });
    }
    onNext();
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-accent-gold mb-2">
          Increase Hit Points
        </h3>
        <p className="text-[#992600]">
          Choose how you want to increase your HP. You can take the average (safer) or roll the dice (riskier).
        </p>
      </div>

      {/* Option 1: Take Average */}
      <button
        onClick={handleSelectAverage}
        className={`w-full text-left p-6 rounded-lg border-2 transition-all ${
          hpMethod === 'average'
            ? 'border-accent-gold bg-accent-gold bg-opacity-10'
            : 'border-theme-border bg-theme-primary hover:border-accent-gold hover:border-opacity-50'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="text-lg font-semibold text-accent-gold mb-2">
              Take Average (Recommended)
            </h4>
            <p className="text-theme-text mb-2">
              Gain <span className="text-accent-gold font-bold text-xl">{averageHpGain} HP</span>
            </p>
            <p className="text-sm text-[#992600]">
              Formula: {Math.floor(parseInt(hitDie.substring(1)) / 2) + 1} (average of {hitDie})
              {conModifier !== 0 && ` + ${conModifier} (CON modifier)`}
            </p>
          </div>
          <div className={`flex-shrink-0 ml-4 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
            hpMethod === 'average' ? 'border-accent-gold bg-accent-gold' : 'border-theme-border'
          }`}>
            {hpMethod === 'average' && (
              <svg className="w-4 h-4 text-theme-primary" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        </div>
      </button>

      {/* Option 2: Roll */}
      <div className={`w-full p-6 rounded-lg border-2 transition-all cursor-pointer ${
        hpMethod === 'roll'
          ? 'border-accent-gold bg-accent-gold bg-opacity-10'
          : 'border-theme-border bg-theme-primary hover:border-accent-gold hover:border-opacity-50'
      }`} onClick={handleSelectRoll}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="text-lg font-semibold text-accent-gold mb-2">
              Roll for HP
            </h4>
            {rolledHP !== null ? (
              <>
                <p className="text-theme-text mb-2">
                  You rolled: <span className="text-accent-gold font-bold text-xl">{rolledHP} HP</span>
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRollHP();
                  }}
                  className="text-sm text-accent-gold hover:underline"
                >
                  Roll again
                </button>
              </>
            ) : (
              <p className="text-theme-text mb-2">
                Roll 1{hitDie}{conModifier !== 0 && ` + ${conModifier}`} for your HP increase
              </p>
            )}
            <p className="text-sm text-[#992600] mt-2">
              Possible range: {Math.max(1, 1 + conModifier)} - {Math.max(1, parseInt(hitDie.substring(1)) + conModifier)} HP
            </p>
          </div>
          <div className={`flex-shrink-0 ml-4 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
            hpMethod === 'roll' ? 'border-accent-gold bg-accent-gold' : 'border-theme-border'
          }`}>
            {hpMethod === 'roll' && (
              <svg className="w-4 h-4 text-theme-primary" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Current HP Display */}
      <div className="bg-theme-primary border-2 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-[#992600]">Current HP</p>
            <p className="text-2xl font-bold text-theme-text">{character.maxHitPoints}</p>
          </div>
          <div className="text-accent-gold text-3xl">→</div>
          <div>
            <p className="text-sm text-[#992600]">New HP</p>
            <p className="text-2xl font-bold text-accent-gold">
              {character.maxHitPoints + (hpMethod === 'average' ? averageHpGain : (rolledHP || averageHpGain))}
            </p>
          </div>
        </div>
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
          disabled={hpMethod === 'roll' && rolledHP === null}
          className="px-6 py-3 bg-[#ffaa00] border bg-accent-gold text-theme-primary font-semibold rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
};
