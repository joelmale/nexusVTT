/**
 * StepHighLevelSetup - High-Level Character Creation Setup
 *
 * This step appears when creating a character at level 2 or higher.
 * It provides an overview of features, allows HP roll configuration,
 * and summarizes the choices that will be required.
 */

import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Dices, TrendingUp, Zap, Heart } from 'lucide-react';
import { StepProps } from '../types/wizard.types';
import {
  calculateFeaturesForLevel,
  calculateHPForLevel,
  getASILevelsForCharacter,
  requiresSubclass
} from '../../../utils/highLevelCreationUtils';
import { getModifier } from '../../../services/dataService';

export const StepHighLevelSetup: React.FC<StepProps> = ({
  data,
  updateData,
  nextStep,
  prevStep,
  getNextStepLabel
}) => {
  const [useAverage, setUseAverage] = useState(true);

  const classSlug = data.classSlug?.toLowerCase() || '';
  const targetLevel = data.level || 1;
  const edition = data.edition || '2024';

  // Calculate features
  const features = calculateFeaturesForLevel(classSlug, edition, targetLevel);
  const asiLevels = getASILevelsForCharacter(classSlug, edition, targetLevel);
  const subclassInfo = requiresSubclass(classSlug, edition, targetLevel);

  // Calculate HP
  const hitDie = features?.automaticFeatures[0]?.feature?.description?.match(/d\d+/)?.[0] || 'd8';
  const conModifier = getModifier(data.abilities?.CON || 10);

  // Initialize HP rolls array with lazy state
  const [hpRolls, setHpRolls] = useState<number[]>(() => {
    if (targetLevel > 1) {
      const dieSize = parseInt(hitDie.substring(1));
      const averageRoll = Math.floor(dieSize / 2) + 1;
      return Array(targetLevel - 1).fill(averageRoll);
    }
    return [];
  });

  const hpCalculation = calculateHPForLevel(
    hitDie,
    targetLevel,
    conModifier,
    useAverage ? undefined : hpRolls
  );

  const rollHP = (levelIndex: number) => {
    const dieSize = parseInt(hitDie.substring(1));
    const roll = Math.floor(Math.random() * dieSize) + 1;
    const newRolls = [...hpRolls];
    newRolls[levelIndex] = roll;
    setHpRolls(newRolls);
  };

  const handleNext = () => {
    // Store HP calculation in wizard data
    updateData({
      highLevelSetup: {
        hpRolls: useAverage ? undefined : hpRolls,
        totalHP: hpCalculation.totalHP,
        useAverage
      }
    });
    nextStep();
  };

  if (targetLevel === 1 || !features) {
    // Skip this step for level 1 characters
    nextStep();
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-2xl font-bold text-accent-yellow-light mb-2">
          High-Level Character Setup
        </h3>
        <p className="text-theme-tertiary">
          Configure your level {targetLevel} {data.classSlug}
        </p>
      </div>

      {/* Features Overview */}
      <div className="bg-theme-tertiary/50 border border-theme-primary rounded-lg p-6">
        <h4 className="text-lg font-bold text-accent-yellow-light mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Features You'll Receive
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Automatic Features */}
          <div className="bg-theme-secondary/50 rounded-lg p-4">
            <div className="text-accent-gold font-bold text-2xl mb-1">
              {features.automaticFeatures.length}
            </div>
            <div className="text-theme-tertiary text-sm">
              Automatic Class Features
            </div>
          </div>

          {/* Required Choices */}
          <div className="bg-theme-secondary/50 rounded-lg p-4">
            <div className="text-accent-gold font-bold text-2xl mb-1">
              {features.requiredChoices.length}
            </div>
            <div className="text-theme-tertiary text-sm">
              Choices to Make
            </div>
          </div>

          {/* Proficiency Bonus */}
          <div className="bg-theme-secondary/50 rounded-lg p-4">
            <div className="text-accent-gold font-bold text-2xl mb-1">
              +{features.proficiencyBonus}
            </div>
            <div className="text-theme-tertiary text-sm">
              Proficiency Bonus
            </div>
          </div>
        </div>

        {/* Choice Breakdown */}
        {features.requiredChoices.length > 0 && (
          <div className="mt-4 pt-4 border-t border-theme-border">
            <div className="text-sm font-semibold text-accent-yellow-light mb-2">
              Choices Required:
            </div>
            <ul className="space-y-1 text-sm text-theme-tertiary">
              {subclassInfo.required && (
                <li className="flex items-center gap-2">
                  <span className="text-accent-gold">•</span>
                  Subclass at level {subclassInfo.subclassLevel}
                </li>
              )}
              {asiLevels.map(level => (
                <li key={level} className="flex items-center gap-2">
                  <span className="text-accent-gold">•</span>
                  Ability Score Improvement or Feat at level {level}
                </li>
              ))}
              {features.requiredChoices
                .filter(c => c.choice.type === 'fighting-style')
                .map((c, i) => (
                  <li key={`fs-${i}`} className="flex items-center gap-2">
                    <span className="text-accent-gold">•</span>
                    Fighting Style at level {c.level}
                  </li>
                ))}
              {features.requiredChoices
                .filter(c => c.choice.type === 'spells')
                .length > 0 && (
                <li className="flex items-center gap-2">
                  <span className="text-accent-gold">•</span>
                  Spell selection (cantrips and leveled spells)
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* HP Configuration */}
      <div className="bg-theme-tertiary/50 border border-theme-primary rounded-lg p-6">
        <h4 className="text-lg font-bold text-accent-yellow-light mb-4 flex items-center gap-2">
          <Heart className="w-5 h-5" />
          Hit Points Configuration
        </h4>

        {/* Average vs Roll Toggle */}
        <div className="mb-4">
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setUseAverage(true)}
              className={`p-4 rounded-lg border-2 transition-all ${
                useAverage
                  ? 'bg-accent-red border-red-400 shadow-lg'
                  : 'bg-theme-secondary border-theme-border hover:border-accent-gold/50'
              }`}
            >
              <div className="text-center">
                <TrendingUp className={`w-6 h-6 mx-auto mb-2 ${useAverage ? 'text-white' : 'text-accent-gold'}`} />
                <div className={`font-bold ${useAverage ? 'text-white' : 'text-theme-text'}`}>
                  Take Average
                </div>
                <div className={`text-xs mt-1 ${useAverage ? 'text-gray-200' : 'text-theme-tertiary'}`}>
                  Consistent, recommended
                </div>
              </div>
            </button>

            <button
              onClick={() => setUseAverage(false)}
              className={`p-4 rounded-lg border-2 transition-all ${
                !useAverage
                  ? 'bg-accent-red border-red-400 shadow-lg'
                  : 'bg-theme-secondary border-theme-border hover:border-accent-gold/50'
              }`}
            >
              <div className="text-center">
                <Dices className={`w-6 h-6 mx-auto mb-2 ${!useAverage ? 'text-white' : 'text-accent-gold'}`} />
                <div className={`font-bold ${!useAverage ? 'text-white' : 'text-theme-text'}`}>
                  Roll Dice
                </div>
                <div className={`text-xs mt-1 ${!useAverage ? 'text-gray-200' : 'text-theme-tertiary'}`}>
                  Random, risky
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* HP Breakdown */}
        <div className="bg-theme-secondary/50 rounded-lg p-4">
          <div className="text-sm font-semibold text-accent-yellow-light mb-3">
            HP Breakdown:
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {hpCalculation.breakdown.map((entry, index) => (
              <div
                key={entry.level}
                className="flex items-center justify-between text-sm border-b border-theme-border pb-2"
              >
                <div className="text-theme-tertiary">
                  Level {entry.level}:
                </div>
                <div className="flex items-center gap-2">
                  {entry.level === 1 ? (
                    <span className="text-theme-text">
                      {entry.roll} (max) + {entry.conBonus} CON
                    </span>
                  ) : !useAverage ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => rollHP(index - 1)}
                        className="px-2 py-1 bg-accent-red hover:bg-accent-red-light rounded text-xs text-white"
                      >
                        <Dices className="w-3 h-3" />
                      </button>
                      <span className="text-theme-text">
                        {entry.roll} + {entry.conBonus} CON
                      </span>
                    </div>
                  ) : (
                    <span className="text-theme-text">
                      {entry.roll} (avg) + {entry.conBonus} CON
                    </span>
                  )}
                  <span className="text-accent-gold font-bold">
                    = {entry.total}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-theme-border flex justify-between items-center">
            <span className="text-lg font-bold text-accent-yellow-light">
              Total HP:
            </span>
            <span className="text-2xl font-bold text-accent-gold">
              {hpCalculation.totalHP}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={prevStep}
          className="px-6 py-3 bg-theme-tertiary hover:bg-theme-quaternary rounded-lg text-theme-text flex items-center transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </button>

        <button
          onClick={handleNext}
          className="px-6 py-3 bg-accent-red hover:bg-accent-red-light rounded-lg text-white flex items-center transition-colors"
        >
          Next: {getNextStepLabel?.() || 'Continue'}
          <ArrowRight className="w-5 h-5 ml-2" />
        </button>
      </div>
    </div>
  );
};
