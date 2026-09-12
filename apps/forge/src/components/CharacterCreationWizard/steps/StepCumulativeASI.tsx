/**
 * StepCumulativeASI - Cumulative Ability Score Improvements for High-Level Characters
 *
 * This step handles multiple ASI/Feat choices for characters created at level 4+.
 * Allows distributing ability score increases or selecting feats for each ASI level.
 */

import React, { useState, useMemo } from 'react';
import { ArrowRight, ArrowLeft, TrendingUp, Award, Plus, Minus } from 'lucide-react';
import { StepProps } from '../types/wizard.types';
import { getASILevelsForCharacter } from '../../../utils/highLevelCreationUtils';
import { AbilityName } from '../../../types/dnd';
import { getAvailableFeatsForCharacter } from '../../../utils/featUtils';
import { FEAT_DATABASE } from '../../../services/dataService';

interface ASIChoice {
  level: number;
  type: 'asi' | 'feat';
  asiAllocations: Record<AbilityName, number>; // Ability -> points added
  featSlug?: string;
}

export const StepCumulativeASI: React.FC<StepProps> = ({
  data,
  updateData,
  nextStep,
  prevStep,
  getNextStepLabel
}) => {
  const classSlug = data.classSlug?.toLowerCase() || '';
  const targetLevel = data.level || 1;
  const edition = data.edition || '2024';

  const asiLevels = getASILevelsForCharacter(classSlug, edition, targetLevel);

  const [currentASIIndex, setCurrentASIIndex] = useState(0);

  // Initialize choices based on ASI levels
  const [choices, setChoices] = useState<ASIChoice[]>(() => {
    return asiLevels.map(level => ({
      level,
      type: 'asi',
      asiAllocations: {
        STR: 0,
        DEX: 0,
        CON: 0,
        INT: 0,
        WIS: 0,
        CHA: 0
      }
    }));
  });

  // Load available feats when switching to feat mode
  const availableFeats = useMemo(() => {
    const currentChoice = choices[currentASIIndex];
    if (currentChoice?.type === 'feat') {
      return getAvailableFeatsForCharacter(FEAT_DATABASE, {
        level: data.level,
        classSlug: data.classSlug,
        abilities: data.abilities,
        edition: data.edition,
        speciesSlug: data.speciesSlug,
        selectedLineage: data.selectedLineage
      }, 'asi');
    }
    return [];
  }, [choices, currentASIIndex, data.level, data.classSlug, data.abilities, data.edition, data.speciesSlug, data.selectedLineage]);

  if (asiLevels.length === 0) {
    // No ASI levels, skip this step
    nextStep();
    return null;
  }

  const currentChoice = choices[currentASIIndex];
  const abilities: AbilityName[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

  // Calculate total points allocated for current ASI
  const pointsAllocated = currentChoice?.asiAllocations
    ? Object.values(currentChoice.asiAllocations).reduce((sum, val) => sum + val, 0)
    : 0;
  const maxPoints = 2;
  const remainingPoints = maxPoints - pointsAllocated;

  const handleIncrement = (ability: AbilityName) => {
    if (remainingPoints <= 0 || !currentChoice) return;

    const currentAbilityScore = data.abilities?.[ability] || 10;
    const currentBonus = currentChoice.asiAllocations?.[ability] || 0;

    if (currentAbilityScore + currentBonus >= 20) {
      // Max ability score is 20
      return;
    }

    const newChoices = [...choices];
    newChoices[currentASIIndex] = {
      ...currentChoice,
      asiAllocations: {
        ...currentChoice.asiAllocations,
        [ability]: currentBonus + 1
      }
    };
    setChoices(newChoices);
  };

  const handleDecrement = (ability: AbilityName) => {
    if (!currentChoice) return;

    const currentBonus = currentChoice.asiAllocations?.[ability] || 0;
    if (currentBonus <= 0) return;

    const newChoices = [...choices];
    newChoices[currentASIIndex] = {
      ...currentChoice,
      asiAllocations: {
        ...currentChoice.asiAllocations,
        [ability]: currentBonus - 1
      }
    };
    setChoices(newChoices);
  };

  const handleTypeChange = (type: 'asi' | 'feat') => {
    const newChoices = [...choices];
    newChoices[currentASIIndex] = {
      ...currentChoice,
      type,
      asiAllocations: type === 'asi' ? {
        STR: 0,
        DEX: 0,
        CON: 0,
        INT: 0,
        WIS: 0,
        CHA: 0
      } : {
        STR: 0,
        DEX: 0,
        CON: 0,
        INT: 0,
        WIS: 0,
        CHA: 0
      },
      featSlug: type === 'feat' ? '' : undefined
    };
    setChoices(newChoices);
  };

  const handleNext = () => {
    if (currentASIIndex < asiLevels.length - 1) {
      setCurrentASIIndex(currentASIIndex + 1);
    } else {
      // Save all ASI choices and proceed
      updateData({
        cumulativeASI: choices
      });
      nextStep();
    }
  };

  const handlePrev = () => {
    // Always go to previous wizard step - don't navigate between ASI choices
    prevStep();
  };

  const canProceed = currentChoice?.type === 'asi'
    ? pointsAllocated === maxPoints
    : currentChoice?.featSlug && currentChoice.featSlug.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-2xl font-bold text-accent-yellow-light mb-2">
          Ability Score Improvement
        </h3>
        <p className="text-theme-tertiary">
          Level {currentChoice?.level} ({currentASIIndex + 1} of {asiLevels.length})
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center justify-center gap-2">
        {asiLevels.map((_, index) => (
          <div
            key={index}
            className={`h-2 rounded-full transition-all ${
              index === currentASIIndex
                ? 'w-8 bg-accent-gold'
                : index < currentASIIndex
                  ? 'w-6 bg-green-500'
                  : 'w-6 bg-theme-border'
            }`}
          />
        ))}
      </div>

      {/* Type Selection */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => handleTypeChange('asi')}
          className={`p-6 rounded-lg border-2 transition-all ${
            currentChoice?.type === 'asi'
              ? 'bg-accent-red border-red-400 shadow-lg'
              : 'bg-theme-tertiary border-theme-border hover:border-accent-gold/50'
          }`}
        >
          <div className="text-center">
            <TrendingUp className={`w-8 h-8 mx-auto mb-2 ${currentChoice?.type === 'asi' ? 'text-white' : 'text-accent-gold'}`} />
            <div className={`font-bold text-lg ${currentChoice?.type === 'asi' ? 'text-white' : 'text-theme-text'}`}>
              Ability Score Improvement
            </div>
            <div className={`text-sm mt-1 ${currentChoice?.type === 'asi' ? 'text-gray-200' : 'text-theme-tertiary'}`}>
              Increase 2 abilities by +1 each, or 1 ability by +2
            </div>
          </div>
        </button>

        <button
          onClick={() => handleTypeChange('feat')}
          className={`p-6 rounded-lg border-2 transition-all ${
            currentChoice?.type === 'feat'
              ? 'bg-accent-red border-red-400 shadow-lg'
              : 'bg-theme-tertiary border-theme-border hover:border-accent-gold/50'
          }`}
        >
          <div className="text-center">
            <Award className={`w-8 h-8 mx-auto mb-2 ${currentChoice?.type === 'feat' ? 'text-white' : 'text-accent-gold'}`} />
            <div className={`font-bold text-lg ${currentChoice?.type === 'feat' ? 'text-white' : 'text-theme-text'}`}>
              Take a Feat
            </div>
            <div className={`text-sm mt-1 ${currentChoice?.type === 'feat' ? 'text-gray-200' : 'text-theme-tertiary'}`}>
              Gain a special ability or feature
            </div>
          </div>
        </button>
      </div>

      {/* ASI Allocation */}
      {currentChoice?.type === 'asi' && (
        <div className="bg-theme-tertiary/50 border border-theme-primary rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-bold text-accent-yellow-light">
              Allocate Ability Points
            </h4>
            <div className="text-accent-gold font-bold">
              {remainingPoints} / {maxPoints} points remaining
            </div>
          </div>

          <div className="space-y-3">
            {abilities.map(ability => {
              const baseScore = data.abilities?.[ability] || 10;
              const allocated = currentChoice.asiAllocations?.[ability] || 0;
              const newScore = baseScore + allocated;
              const atMax = newScore >= 20;

              return (
                <div
                  key={ability}
                  className="flex items-center justify-between bg-theme-secondary/50 rounded-lg p-4"
                >
                  <div>
                    <div className="font-bold text-accent-yellow-light">
                      {ability}
                    </div>
                    <div className="text-sm text-theme-tertiary">
                      Current: {baseScore} → New: {newScore}
                      {atMax && <span className="text-amber-400 ml-2">(Max)</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleDecrement(ability)}
                      disabled={allocated === 0}
                      className="w-8 h-8 bg-theme-quaternary hover:bg-accent-red disabled:bg-theme-disabled disabled:cursor-not-allowed rounded-lg flex items-center justify-center transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>

                    <div className="w-8 text-center font-bold text-accent-gold">
                      {allocated > 0 ? `+${allocated}` : '0'}
                    </div>

                    <button
                      onClick={() => handleIncrement(ability)}
                      disabled={remainingPoints === 0 || atMax}
                      className="w-8 h-8 bg-theme-quaternary hover:bg-green-600 disabled:bg-theme-disabled disabled:cursor-not-allowed rounded-lg flex items-center justify-center transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {remainingPoints > 0 && (
            <div className="mt-4 p-3 bg-amber-400/20 border border-amber-400 rounded-lg text-amber-200 text-sm">
              ⚠️ You must allocate all {maxPoints} points before proceeding.
            </div>
          )}
        </div>
      )}

      {/* Feat Selection */}
      {currentChoice?.type === 'feat' && (
        <div className="bg-theme-tertiary/50 border border-theme-primary rounded-lg p-6">
          <h4 className="text-lg font-bold text-accent-yellow-light mb-4">
            Select a Feat
          </h4>

          <div className="text-theme-tertiary text-sm mb-4">
            Choose from the available feats below. Each feat provides unique benefits to your character.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
            {availableFeats.map(feat => (
              <button
                key={feat.slug}
                onClick={() => {
                  const newChoices = [...choices];
                  newChoices[currentASIIndex] = {
                    ...currentChoice,
                    featSlug: feat.slug
                  };
                  setChoices(newChoices);
                }}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  currentChoice.featSlug === feat.slug
                    ? 'bg-accent-green border-green-400 shadow-lg'
                    : 'bg-theme-secondary border-theme-border hover:border-accent-gold/50'
                }`}
              >
                <div className="font-bold text-accent-yellow-light mb-1">
                  {feat.name}
                </div>
                <div className="text-xs text-theme-tertiary mb-2 uppercase">
                  {feat.category.replace('_', ' ')}
                </div>
                <div className="text-sm text-theme-text line-clamp-3">
                  {feat.description.split('\n')[0]} {/* First line of description */}
                </div>
              </button>
            ))}
          </div>

          {availableFeats.length === 0 && (
            <div className="text-center text-theme-tertiary py-8">
              No feats available at this level.
            </div>
          )}

          {!currentChoice.featSlug && availableFeats.length > 0 && (
            <div className="mt-4 p-3 bg-amber-400/20 border border-amber-400 rounded-lg text-amber-200 text-sm">
              ⚠️ You must select a feat before proceeding.
            </div>
          )}
        </div>
      )}

      {/* Summary of Completed Choices */}
      {currentASIIndex > 0 && (
        <div className="bg-theme-secondary/30 border border-theme-border rounded-lg p-4">
          <h5 className="text-sm font-bold text-accent-yellow-light mb-2">
            Previous Choices:
          </h5>
          <div className="space-y-1 text-sm text-theme-tertiary">
            {choices.slice(0, currentASIIndex).map((choice, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-accent-gold">•</span>
                <span>
                  Level {choice.level}:{' '}
                  {choice.type === 'asi'
                    ? Object.entries(choice.asiAllocations || {})
                        .filter(([_, val]) => val > 0)
                        .map(([ability, val]) => `${ability} +${val}`)
                        .join(', ')
                    : `Feat: ${choice.featSlug}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={handlePrev}
          className="px-6 py-3 bg-theme-tertiary hover:bg-theme-quaternary rounded-lg text-theme-text flex items-center transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          {currentASIIndex > 0 ? 'Previous ASI' : 'Back'}
        </button>

        <button
          onClick={handleNext}
          disabled={!canProceed}
          className="px-6 py-3 bg-accent-red hover:bg-accent-red-light disabled:bg-theme-disabled disabled:cursor-not-allowed rounded-lg text-white flex items-center transition-colors"
        >
          {currentASIIndex < asiLevels.length - 1 ? 'Next ASI' : getNextStepLabel?.() || 'Continue'}
          <ArrowRight className="w-5 h-5 ml-2" />
        </button>
      </div>
    </div>
  );
};
