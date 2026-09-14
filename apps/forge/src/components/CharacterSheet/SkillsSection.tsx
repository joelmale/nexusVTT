import React from 'react';
import { Character, SkillName } from '../../types/dnd';
import { SkillEntry } from './index';
import type { LayoutMode } from './AbilityScores';
import { DiceRoll } from '../../services/diceService';

interface SkillsSectionProps {
  character: Character;
  setRollResult: (result: { text: string; value: number | null }) => void;
  onDiceRoll: (roll: DiceRoll) => void;
  layoutMode?: LayoutMode;
}

export const SkillsSection: React.FC<SkillsSectionProps> = ({
  character,
  setRollResult,
  onDiceRoll,
  layoutMode = 'modern',
}) => {
  const skills = Object.entries(character.skills) as [SkillName, { value: number; proficient: boolean }][];

  // Classic layout: Single column, compact
  if (layoutMode === 'classic-dnd') {
    return (
      <div className="space-y-1">
        {skills.sort((a, b) => a[0].localeCompare(b[0])).map(([name, skill]) => (
          <SkillEntry
            key={name}
            name={name}
            skill={skill}
            setRollResult={setRollResult}
            onDiceRoll={onDiceRoll}
            layoutMode="classic-dnd"
          />
        ))}
      </div>
    );
  }

  // Modern layout: 5-column grid
  return (
    <div className="grid grid-cols-5 gap-2">
      {skills.sort((a, b) => a[0].localeCompare(b[0])).map(([name, skill]) => (
        <SkillEntry
          key={name}
          name={name}
          skill={skill}
          setRollResult={setRollResult}
          onDiceRoll={onDiceRoll}
        />
      ))}
    </div>
  );
};