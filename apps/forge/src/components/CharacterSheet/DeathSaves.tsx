import React from 'react';
import { Heart } from 'lucide-react';
import { Character } from '../../types/dnd';

interface DeathSavesProps {
  character: Character;
  onUpdateCharacter: (character: Character) => void;
  layoutMode?: 'paper-sheet' | 'classic-dnd' | 'modern';
}

export const DeathSaves: React.FC<DeathSavesProps> = ({
  character,
  onUpdateCharacter,
  layoutMode = 'paper-sheet',
}) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _updateDeathSaves = (field: 'successes' | 'failures', delta: number) => {
    const current = character.deathSaves || { successes: 0, failures: 0 };
    const newValue = Math.max(0, Math.min(3, current[field] + delta));

    onUpdateCharacter({
      ...character,
      deathSaves: {
        ...current,
        [field]: newValue
      }
    });
  };

  const resetDeathSaves = () => {
    onUpdateCharacter({
      ...character,
      deathSaves: { successes: 0, failures: 0 }
    });
  };

  const deathSaves = character.deathSaves || { successes: 0, failures: 0 };

  // Determine color scheme based on layout mode
  const isPaperSheet = layoutMode === 'paper-sheet';
  const bgClass = isPaperSheet ? 'bg-[#f5ebd2]' : 'bg-theme-tertiary/50';
  const borderClass = isPaperSheet ? 'border-[#1e140a]/20' : 'border-theme-secondary';
  const textSecondaryClass = isPaperSheet ? 'text-[#3d2817]' : 'text-theme-tertiary';
  const hoverTextClass = isPaperSheet ? 'hover:text-[#8b4513]' : 'hover:text-theme-primary';
  const emptyBorderClass = isPaperSheet ? 'border-[#3d2817]' : 'border-theme-muted';

  const toggleSuccess = (index: number) => {
    const current = character.deathSaves || { successes: 0, failures: 0 };
    // If clicking on an already-filled circle, reduce the count
    // If clicking on an empty circle, increase to that position
    const newSuccesses = index < current.successes ? index : index + 1;
    onUpdateCharacter({
      ...character,
      deathSaves: {
        ...current,
        successes: newSuccesses
      }
    });
  };

  const toggleFailure = (index: number) => {
    const current = character.deathSaves || { successes: 0, failures: 0 };
    const newFailures = index < current.failures ? index : index + 1;
    onUpdateCharacter({
      ...character,
      deathSaves: {
        ...current,
        failures: newFailures
      }
    });
  };

  return (
    <div className={`${bgClass} border ${borderClass} rounded-sm p-3`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-xs font-cinzel font-bold ${textSecondaryClass} uppercase tracking-wider flex items-center gap-1`}>
          <Heart className="w-3 h-3" />
          Death Saves
        </h3>
        <button
          onClick={resetDeathSaves}
          className={`text-xs font-cinzel ${textSecondaryClass} ${hoverTextClass}`}
          title="Reset death saves"
        >
          Reset
        </button>
      </div>
      <div className="space-y-2">
        {/* Successes */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-accent-green font-semibold">Successes</span>
          <div className="flex gap-2">
            {[0, 1, 2].map(i => (
              <button
                key={i}
                onClick={() => toggleSuccess(i)}
                className={`w-4 h-4 rounded-full border-2 transition-all hover:scale-110 ${
                  i < deathSaves.successes
                    ? 'bg-accent-green border-accent-green'
                    : `${emptyBorderClass} hover:border-accent-green`
                }`}
                title={`Success ${i + 1}`}
              />
            ))}
          </div>
        </div>
        {/* Failures */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-accent-red font-semibold">Failures</span>
          <div className="flex gap-2">
            {[0, 1, 2].map(i => (
              <button
                key={i}
                onClick={() => toggleFailure(i)}
                className={`w-4 h-4 rounded-full border-2 transition-all hover:scale-110 ${
                  i < deathSaves.failures
                    ? 'bg-accent-red border-accent-red'
                    : `${emptyBorderClass} hover:border-accent-red`
                }`}
                title={`Failure ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
