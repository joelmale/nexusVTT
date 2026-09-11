import React from 'react';
import { ArrowRight, Shuffle } from 'lucide-react';
import { StepProps } from '../types/wizard.types';
import { randomizeLevel } from '../../../services/dataService';

interface RandomizeButtonProps {
  onClick: () => void;
  title: string;
}

const RandomizeButton: React.FC<RandomizeButtonProps> = ({ onClick, title }) => (
  <button
    onClick={onClick}
    title={title}
    className="p-2 bg-accent-yellow-dark hover:bg-accent-yellow rounded-lg text-white transition-colors"
  >
    <Shuffle className="w-4 h-4" />
  </button>
);

export const Step0Level: React.FC<StepProps> = ({ data, updateData, nextStep, getNextStepLabel }) => {
  const milestoneLevels = [2, 3, 4, 5, 6, 8, 11, 12, 14, 16, 17, 19, 20];

  const getMilestoneIcon = (level: number) => {
    const icons = {
      2: '🎯', 3: '🛡️', 4: '💪', 5: '⚔️', 6: '🛡️',
      8: '💪', 11: '💪', 12: '🛡️', 14: '💪', 16: '💪',
      17: '🛡️', 19: '💪', 20: '👑'
    };
    return icons[level as keyof typeof icons] || '⚡';
  };

  const getLevelDescription = (level: number) => {
    const descriptions = {
      1: "Fresh adventurer, just starting your journey",
      2: "Gain your class's signature feature (Fighting Style, Spellcasting, etc.)",
      3: "Choose your subclass to specialize your abilities",
      4: "Ability Score Improvement (+2) or take a Feat",
      5: "Extra Attack - make two attacks per turn",
      6: "Enhanced subclass features and abilities",
      7: "Growing in power and reputation",
      8: "Ability Score Improvement (+2) or take a Feat",
      9: "Enhanced subclass features and abilities",
      10: "Experienced hero with significant capabilities",
      11: "Ability Score Improvement (+2) or take a Feat",
      12: "Enhanced subclass features and abilities",
      13: "Master level with exceptional power",
      14: "Ability Score Improvement (+2) or take a Feat",
      15: "Enhanced subclass features and abilities",
      16: "Ability Score Improvement (+2) or take a Feat",
      17: "Enhanced subclass features and abilities",
      18: "Growing legendary status and power",
      19: "Ability Score Improvement (+2) or take a Feat",
      20: "Epic capstone features and legendary abilities"
    };
    return descriptions[level as keyof typeof descriptions] || `Level ${level} adventurer`;
  };

  return (
    <div className='space-y-6'>
      <div className='text-center relative'>
        <div className='absolute top-0 right-0'>
          <RandomizeButton
            onClick={() => updateData({ level: randomizeLevel() })}
            title="Randomize character level"
          />
        </div>
        <h3 className='text-2xl font-bold text-accent-yellow-light mb-2'>Choose Your Level</h3>
        <p className='text-theme-tertiary'>Select your character's starting level (1-20)</p>
      </div>

      <div className='grid grid-cols-5 md:grid-cols-10 gap-3 max-w-4xl mx-auto'>
        {Array.from({ length: 20 }, (_, i) => i + 1).map(level => {
          const isMilestone = milestoneLevels.includes(level);
          const isSelected = data.level === level;

          return (
            <button
              key={level}
              onClick={() => updateData({ level })}
              className={`relative p-3 rounded-lg border-2 transition-all duration-200 ${
                isSelected
                  ? 'bg-accent-red border-red-400 shadow-lg shadow-red-500/25'
                  : isMilestone
                    ? 'bg-accent-yellow-dark/20 border-yellow-500 hover:bg-accent-yellow-dark/30'
                    : 'bg-theme-tertiary border-theme-primary hover:bg-theme-quaternary'
              }`}
            >
              <div className={`text-center ${isSelected ? 'text-white' : isMilestone ? 'text-accent-yellow-light' : 'text-theme-tertiary'}`}>
                <div className='font-bold text-lg'>{level}</div>
                {isMilestone && (
                  <div className='text-xs mt-1 opacity-75'>{getMilestoneIcon(level)}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {data.level && (
        <div className='bg-theme-tertiary/50 border border-theme-primary rounded-lg p-4 max-w-2xl mx-auto'>
          <div className='text-center'>
            <h4 className='text-lg font-bold text-accent-yellow-light mb-2'>Level {data.level}</h4>
            <p className='text-theme-tertiary'>{getLevelDescription(data.level)}</p>
            {milestoneLevels.includes(data.level) && (
              <div className='mt-3 p-2 bg-accent-yellow-dark/20 border border-yellow-500 rounded'>
                <p className='text-accent-yellow-light text-sm font-semibold'>🎯 Milestone Level</p>
                <p className='text-yellow-200 text-xs mt-1'>
                  {data.level === 2 && "Gain your class's signature feature (Fighting Style, Spellcasting, etc.)"}
                  {data.level === 3 && "Choose your subclass to specialize your abilities"}
                  {data.level === 4 && "Ability Score Improvement (+2) or take a Feat"}
                  {data.level === 5 && "Extra Attack - make two attacks per turn"}
                  {data.level === 6 && "Enhanced subclass features and abilities"}
                  {data.level === 8 && "Ability Score Improvement (+2) or take a Feat"}
                  {data.level === 11 && "Ability Score Improvement (+2) or take a Feat"}
                  {data.level === 12 && "Enhanced subclass features and abilities"}
                  {data.level === 14 && "Ability Score Improvement (+2) or take a Feat"}
                  {data.level === 16 && "Ability Score Improvement (+2) or take a Feat"}
                  {data.level === 17 && "Enhanced subclass features and abilities"}
                  {data.level === 19 && "Ability Score Improvement (+2) or take a Feat"}
                  {data.level === 20 && "Epic capstone features and legendary abilities"}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className='flex justify-end'>
        <button
          onClick={nextStep}
          disabled={!data.level}
          className="px-6 py-3 bg-accent-red hover:bg-accent-red-light rounded-lg text-white flex items-center disabled:bg-theme-quaternary disabled:cursor-not-allowed transition-colors"
        >
          Next: {getNextStepLabel?.() || 'Continue'} <ArrowRight className="w-5 h-5 ml-2" />
        </button>
      </div>
    </div>
  );
};