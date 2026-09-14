import React, { useState } from 'react';
import { ABILITY_SCORES, Ability } from '../types/dnd';

interface AbilityScoreIncreaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (increases: Partial<Record<Ability, number>>) => void;
}

const AbilityScoreIncreaseModal: React.FC<AbilityScoreIncreaseModalProps> = ({ isOpen, onClose, onApply }) => {
  const [increases, setIncreases] = useState<Partial<Record<Ability, number>>>({});
  const [points, setPoints] = useState(2);

  const handleIncrease = (ability: Ability) => {
    if (points > 0) {
      setIncreases(prev => ({ ...prev, [ability]: (prev[ability] || 0) + 1 }));
      setPoints(points - 1);
    }
  };

  const handleDecrease = (ability: Ability) => {
    if (increases[ability] && increases[ability]! > 0) {
      setIncreases(prev => ({ ...prev, [ability]: (prev[ability] || 0) - 1 }));
      setPoints(points + 1);
    }
  };

  const handleApply = () => {
    onApply(increases);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-md flex justify-center items-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Ability Score Increase</h2>
        <p className="mb-4">You have {points} points to distribute.</p>
        <div className="space-y-4">
          {ABILITY_SCORES.map(ability => (
            <div key={ability} className="flex justify-between items-center">
              <span className="text-lg font-semibold">{ability}</span>
              <div className="flex items-center">
                <button
                  onClick={() => handleDecrease(ability)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-1 px-3 rounded-l"
                >
                  -
                </button>
                <span className="px-4 py-1 bg-gray-200">{increases[ability] || 0}</span>
                <button
                  onClick={() => handleIncrease(ability)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-1 px-3 rounded-r"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={points > 0}
            className="bg-accent-blue-light hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default AbilityScoreIncreaseModal;
