import React, { useState, useMemo } from 'react';
import { X, Check, Plus, Minus } from 'lucide-react';

interface AbilityScoreEditModalProps {
  currentScores: Record<string, number>;
  isOpen: boolean;
  onClose: () => void;
  onSave: (scores: Record<string, number>) => void;
}

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const ABILITY_NAMES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const ABILITY_FULL_NAMES: Record<string, string> = {
  STR: 'Strength',
  DEX: 'Dexterity',
  CON: 'Constitution',
  INT: 'Intelligence',
  WIS: 'Wisdom',
  CHA: 'Charisma'
};

const AbilityScoreEditModal: React.FC<AbilityScoreEditModalProps> = ({
  currentScores,
  isOpen,
  onClose,
  onSave
}) => {
  const [scores, setScores] = useState<Record<string, number>>(currentScores);

  // Calculate available values from standard array
  const availableValues = useMemo(() => {
    const usedValues = Object.values(scores);
    return STANDARD_ARRAY.filter(val => {
      const timesUsed = usedValues.filter(used => used === val).length;
      const timesInArray = STANDARD_ARRAY.filter(arrayVal => arrayVal === val).length;
      return timesUsed < timesInArray;
    });
  }, [scores]);

  // Calculate points available (should be 0 when using standard array correctly)
  const pointsAvailable = useMemo(() => {
    const totalUsed = Object.values(scores).reduce((sum, val) => sum + val, 0);
    const totalArray = STANDARD_ARRAY.reduce((sum, val) => sum + val, 0);
    return totalArray - totalUsed;
  }, [scores]);

  const handleIncrease = (ability: string) => {
    const currentValue = scores[ability];
    const sortedAvailable = [...availableValues, currentValue].sort((a, b) => b - a);
    const currentIndex = sortedAvailable.indexOf(currentValue);

    if (currentIndex > 0) {
      const nextValue = sortedAvailable[currentIndex - 1];
      setScores({ ...scores, [ability]: nextValue });
    }
  };

  const handleDecrease = (ability: string) => {
    const currentValue = scores[ability];
    const sortedAvailable = [...availableValues, currentValue].sort((a, b) => b - a);
    const currentIndex = sortedAvailable.indexOf(currentValue);

    if (currentIndex < sortedAvailable.length - 1) {
      const nextValue = sortedAvailable[currentIndex + 1];
      setScores({ ...scores, [ability]: nextValue });
    }
  };

  const getModifier = (score: number) => {
    return Math.floor((score - 10) / 2);
  };

  const handleSave = () => {
    if (pointsAvailable === 0) {
      onSave(scores);
      onClose();
    }
  };

  const handleReset = () => {
    setScores(currentScores);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-theme-secondary rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-theme-secondary">
          <div>
            <h2 className="text-xl font-bold text-white">Edit Ability Scores</h2>
            <p className="text-sm text-theme-muted">
              Redistribute the standard array values (15, 14, 13, 12, 10, 8)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-theme-tertiary rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-theme-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Points Available */}
          <div className={`mb-6 p-4 rounded-lg border-2 ${
            pointsAvailable === 0
              ? 'bg-accent-green-darker/20 border-accent-green-dark'
              : 'bg-accent-yellow-darker/20 border-accent-yellow-dark'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Points Avail</h3>
                <p className="text-xs text-theme-muted">
                  {pointsAvailable === 0
                    ? 'All standard array values assigned correctly'
                    : 'Adjust scores to use all standard array values'
                  }
                </p>
              </div>
              <div className={`text-3xl font-bold ${
                pointsAvailable === 0 ? 'text-accent-green-light' : 'text-accent-yellow-light'
              }`}>
                {pointsAvailable}
              </div>
            </div>
          </div>

          {/* Ability Scores Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {ABILITY_NAMES.map(ability => {
              const score = scores[ability];
              const modifier = getModifier(score);
              const canIncrease = availableValues.some(val => val > score);
              const canDecrease = availableValues.some(val => val < score) || score > Math.min(...STANDARD_ARRAY);

              return (
                <div key={ability} className="bg-theme-tertiary rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-theme-muted uppercase">{ability}</h4>
                      <p className="text-xs text-theme-disabled">{ABILITY_FULL_NAMES[ability]}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-accent-yellow-light">{score}</div>
                      <div className="text-sm text-accent-green-light">
                        {modifier >= 0 ? '+' : ''}{modifier}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDecrease(ability)}
                      disabled={!canDecrease}
                      className={`flex-1 px-3 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-1 ${
                        canDecrease
                          ? 'bg-accent-red-dark hover:bg-accent-red text-white'
                          : 'bg-theme-quaternary text-theme-muted cursor-not-allowed'
                      }`}
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleIncrease(ability)}
                      disabled={!canIncrease}
                      className={`flex-1 px-3 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-1 ${
                        canIncrease
                          ? 'bg-accent-green-dark hover:bg-accent-green text-white'
                          : 'bg-theme-quaternary text-theme-muted cursor-not-allowed'
                      }`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Standard Array Reference */}
          <div className="bg-theme-tertiary/50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-theme-muted mb-2">Standard Array Values</h4>
            <div className="flex gap-2 flex-wrap">
              {STANDARD_ARRAY.map((value, idx) => (
                <div key={idx} className="px-3 py-1 bg-theme-quaternary rounded text-center">
                  <div className="text-lg font-bold text-accent-yellow-light">{value}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-theme-disabled mt-2">
              Each value must be used exactly once across all six abilities
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-theme-secondary bg-theme-primary">
          <button
            onClick={handleReset}
            className="px-6 py-2 bg-theme-tertiary hover:bg-theme-quaternary rounded-lg text-white transition-colors"
          >
            Reset
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-theme-tertiary hover:bg-theme-quaternary rounded-lg text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={pointsAvailable !== 0}
              className={`px-6 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
                pointsAvailable === 0
                  ? 'bg-accent-purple hover:bg-accent-purple-light text-white'
                  : 'bg-theme-quaternary text-theme-muted cursor-not-allowed'
              }`}
            >
              <Check className="w-5 h-5" />
              Save Scores
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AbilityScoreEditModal;
