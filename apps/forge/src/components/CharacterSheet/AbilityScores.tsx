import React from 'react';
import { Character, AbilityName } from '../../types/dnd';
import { AbilityScoreBlock } from './index';
import { DiceRoll } from '../../services/diceService';
import { calculateEquipmentBonuses } from '../../utils/equipmentUtils';

export type LayoutMode = 'modern-stacked' | 'classic-dnd' | 'mobile' | 'paper-sheet';

interface AbilityScoresProps {
  character: Character;
  setRollResult: (result: { text: string; value: number | null }) => void;
  onDiceRoll: (roll: DiceRoll) => void;
  onToggleInspiration: (characterId: string) => void;
  layoutMode?: LayoutMode;
}

export const AbilityScores: React.FC<AbilityScoresProps> = ({
  character,
  setRollResult,
  onDiceRoll,
  onToggleInspiration: _onToggleInspiration,
  layoutMode = 'modern',
}) => {
  const abilities = Object.entries(character.abilities) as [AbilityName, { score: number; modifier: number }][];
  const equipmentBonuses = calculateEquipmentBonuses(character);

  // Classic D&D layout: Single column, large circular design
  if (layoutMode === 'classic-dnd') {
    return (
      <div className="space-y-3">
        {abilities.map(([name, ability]) => (
          <AbilityScoreBlock
            key={name}
            name={name}
            ability={ability}
            equipmentBonus={equipmentBonuses.abilityModifiers[name]}
            setRollResult={setRollResult}
            onDiceRoll={onDiceRoll}
            layoutMode="classic-dnd"
          />
        ))}
      </div>
    );
  }

  // Modern stacked layout: Single row (6 columns)
  return (
    <div className="grid grid-cols-6 gap-2">
      {abilities.map(([name, ability]) => (
        <AbilityScoreBlock
          key={name}
          name={name}
          ability={ability}
          equipmentBonus={equipmentBonuses.abilityModifiers[name]}
          setRollResult={setRollResult}
          onDiceRoll={onDiceRoll}
          layoutMode="modern-stacked"
        />
      ))}
    </div>
  );
};