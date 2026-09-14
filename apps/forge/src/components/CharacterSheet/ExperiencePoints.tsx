import React, { useState } from 'react';
import { Trophy, TrendingUp } from 'lucide-react';
import { Character } from '../../types/dnd';

interface ExperiencePointsProps {
  character: Character;
  onUpdateCharacter: (character: Character) => void;
}

export const ExperiencePoints: React.FC<ExperiencePointsProps> = ({
  character,
  onUpdateCharacter,
}) => {
  const [xpInput, setXpInput] = useState('');

  // XP thresholds for levels 1-20
  const xpThresholds = [
    0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
    85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000
  ];

  const currentLevelXP = xpThresholds[character.level - 1] || 0;
  const nextLevelXP = xpThresholds[character.level] || 355000;
  const currentXP = character.experiencePoints || 0;
  const xpToNext = Math.max(0, nextLevelXP - currentXP);
  const progressPercent = Math.min(100, ((currentXP - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100);

  const addXP = () => {
    const xpToAdd = parseInt(xpInput);
    if (isNaN(xpToAdd) || xpToAdd <= 0) return;

    const newXP = currentXP + xpToAdd;
    const updatedCharacter = {
      ...character,
      experiencePoints: newXP
    };

    onUpdateCharacter(updatedCharacter);
    setXpInput('');
  };

  const levelUp = () => {
    if (currentXP < nextLevelXP) return;

    // This would trigger the level up modal/flow
    // For now, just show an alert
    alert(`Level up available! Current XP: ${currentXP}, Required: ${nextLevelXP}`);
  };

  return (
    <div className="bg-indigo-900 rounded-xl shadow-lg border-l-4 border-yellow-500 p-4">
      <h3 className="text-lg font-bold text-accent-yellow-light mb-4 flex items-center gap-2">
        <Trophy className="w-5 h-5" />
        Experience Points
      </h3>

      <div className="space-y-4">
        {/* Current XP Display */}
        <div className="text-center">
          <div className="text-3xl font-bold text-theme-primary mb-1">
            {currentXP.toLocaleString()}
          </div>
          <div className="text-sm text-theme-muted">Total XP</div>
        </div>

        {/* Level Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-theme-muted">Level {character.level}</span>
            <span className="text-theme-muted">Level {character.level + 1}</span>
          </div>
          <div className="w-full bg-theme-tertiary rounded-full h-3">
            <div
              className="bg-gradient-to-r from-yellow-500 to-yellow-400 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
          <div className="text-center text-sm text-theme-muted">
            {xpToNext.toLocaleString()} XP to next level
          </div>
        </div>

        {/* XP Input */}
        <div className="flex gap-2">
          <input
            type="number"
            value={xpInput}
            onChange={(e) => setXpInput(e.target.value)}
            placeholder="Enter XP to add"
            className="flex-1 px-3 py-2 input-handwritten focus:border-yellow-500"
          />
          <button
            onClick={addXP}
            className="px-4 py-2 bg-accent-yellow-dark hover:bg-accent-yellow rounded text-sm font-medium transition-colors flex items-center gap-1"
          >
            <TrendingUp className="w-4 h-4" />
            Add XP
          </button>
        </div>

        {/* Level Up Button */}
        {currentXP >= nextLevelXP && (
          <button
            onClick={levelUp}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 rounded-lg text-theme-primary font-bold transition-all duration-200 transform hover:scale-105 shadow-lg"
          >
            🎉 LEVEL UP AVAILABLE! 🎉
          </button>
        )}

        {/* XP Milestones */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-theme-secondary/50 p-2 rounded text-center">
            <div className="text-accent-yellow-light font-semibold">This Level</div>
            <div className="text-theme-tertiary">{currentLevelXP.toLocaleString()} XP</div>
          </div>
          <div className="bg-theme-secondary/50 p-2 rounded text-center">
            <div className="text-accent-yellow-light font-semibold">Next Level</div>
            <div className="text-theme-tertiary">{nextLevelXP.toLocaleString()} XP</div>
          </div>
        </div>
      </div>
    </div>
  );
};