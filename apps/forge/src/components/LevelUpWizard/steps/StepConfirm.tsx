/**
 * Level-Up Wizard - Confirmation Step
 *
 * Final summary and confirmation before applying level-up
 */

import React from 'react';
import { Character, LevelUpChoices } from '../../../types/dnd';
import { LevelUpData } from '../../../data/classProgression';

interface StepConfirmProps {
  character: Character;
  levelUpData: LevelUpData;
  choices: LevelUpChoices;
  onComplete: () => void;
  onPrev: () => void;
}

export const StepConfirm: React.FC<StepConfirmProps> = ({
  character,
  levelUpData,
  choices,
  onComplete,
  onPrev
}) => {
  const { fromLevel, toLevel } = levelUpData;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-accent-gold mb-2">
          Confirm Level Up
        </h3>
        <p className="text-[#992600]">
          Review your choices before finalizing your level-up.
        </p>
      </div>

      {/* Character Summary */}
      <div className="bg-theme-primary rounded-lg p-5 border-2 border-accent-gold border-opacity-30">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-xl font-bold text-theme-text">{character.name}</h4>
            <p className="text-[#992600]">{character.species} {character.class}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-[#992600]">Level</p>
            <p className="text-3xl font-bold text-accent-gold">
              {fromLevel} → {toLevel}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-theme-border">
          <div>
            <p className="text-sm text-[#992600]">Max HP</p>
            <p className="text-lg font-semibold text-theme-text">
              {character.maxHitPoints} → {character.maxHitPoints + (choices.hpGained || 0)}
              <span className="text-accent-gold ml-2">+{choices.hpGained || 0}</span>
            </p>
          </div>
          <div>
            <p className="text-sm text-[#992600]">Prof. Bonus</p>
            <p className="text-lg font-semibold text-theme-text">
              {character.proficiencyBonus === levelUpData.newProficiencyBonus
                ? `${character.proficiencyBonus}`
                : `${character.proficiencyBonus} → ${levelUpData.newProficiencyBonus}`}
            </p>
          </div>
        </div>
      </div>

      {/* Choices Made */}
      <div className="space-y-3">
        {/* HP Choice */}
        <div className="bg-theme-primary rounded-lg p-4">
          <h5 className="font-semibold text-accent-gold mb-1">Hit Points</h5>
          <p className="text-theme-text">
            {choices.hpRoll
              ? `Rolled ${choices.hpRoll} HP`
              : `Taking average: ${choices.hpGained} HP`}
          </p>
        </div>

        {/* ASI/Feat Choice */}
        {(choices.asiChoices || choices.featChosen) && (
          <div className="bg-theme-primary rounded-lg p-4">
            <h5 className="font-semibold text-accent-gold mb-1">Ability Score Improvement</h5>
            {choices.asiChoices && (
              <ul className="text-theme-text space-y-1">
                {choices.asiChoices.map((choice: { ability: string; increase: number }, index: number) => (
                  <li key={index}>
                    {choice.ability}: {character.abilities[choice.ability as keyof typeof character.abilities].score}
                    {' → '}
                    {character.abilities[choice.ability as keyof typeof character.abilities].score + choice.increase}
                    <span className="text-accent-gold ml-2">+{choice.increase}</span>
                  </li>
                ))}
              </ul>
            )}
            {choices.featChosen && (
              <p className="text-theme-text">Feat: {choices.featChosen}</p>
            )}
          </div>
        )}

        {/* Subclass Choice */}
        {choices.subclassChosen && (
          <div className="bg-theme-primary rounded-lg p-4">
            <h5 className="font-semibold text-accent-gold mb-1">Subclass</h5>
            <p className="text-theme-text">{choices.subclassChosen}</p>
          </div>
        )}

        {/* Fighting Style */}
        {choices.fightingStyleChosen && (
          <div className="bg-theme-primary rounded-lg p-4">
            <h5 className="font-semibold text-accent-gold mb-1">Fighting Style</h5>
            <p className="text-theme-text">{choices.fightingStyleChosen}</p>
          </div>
        )}

        {/* Spells Learned */}
        {choices.spellsLearned && choices.spellsLearned.length > 0 && (
          <div className="bg-theme-primary rounded-lg p-4">
            <h5 className="font-semibold text-accent-gold mb-1">Spells Learned</h5>
            <ul className="text-theme-text space-y-1">
              {choices.spellsLearned.map((spell: string, index: number) => (
                <li key={index}>• {spell}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Features Gained */}
        {levelUpData.features.filter(f => f.automatic).length > 0 && (
          <div className="bg-theme-primary rounded-lg p-4">
            <h5 className="font-semibold text-accent-gold mb-1">Features Gained</h5>
            <ul className="text-theme-text space-y-1">
              {levelUpData.features
                .filter(f => f.automatic)
                .map((feature, index) => (
                  <li key={index}>• {feature.name}</li>
                ))}
            </ul>
          </div>
        )}
      </div>

      {/* Warning Notice */}
      <div className="bg-accent-gold bg-opacity-10 border border-accent-gold rounded-lg p-4">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-accent-gold mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-theme-text">
            Once you confirm, these changes will be applied to your character. Make sure everything looks correct!
          </p>
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
          onClick={onComplete}
          className="px-6 py-3 bg-[#ffaa00] border bg-accent-gold text-theme-primary font-semibold rounded-lg hover:bg-opacity-90 transition-colors flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Level Up!
        </button>
      </div>
    </div>
  );
};
