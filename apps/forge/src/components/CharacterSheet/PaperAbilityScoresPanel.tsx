import React from 'react';
import { Character } from '../../types/dnd';
import { createAbilityRoll, DiceRoll } from '../../services/diceService';

interface PaperAbilityScoresPanelProps {
  character: Character;
  setRollResult: (result: {
    text: string;
    value: number | null;
    details?: Array<{ value: number; kept: boolean; critical?: 'success' | 'failure' }>;
  }) => void;
  onDiceRoll: (roll: DiceRoll) => void;
  onToggleInspiration?: (characterId: string) => void;
}

 const ABILITIES = [
   { key: 'STR', name: 'Strength', row: 0, col: 0 },
   { key: 'DEX', name: 'Dexterity', row: 0, col: 1 },
   { key: 'CON', name: 'Constitution', row: 0, col: 2 },
   { key: 'INT', name: 'Intelligence', row: 1, col: 0 },
   { key: 'WIS', name: 'Wisdom', row: 1, col: 1 },
   { key: 'CHA', name: 'Charisma', row: 1, col: 2 },
 ] as const;

export const PaperAbilityScoresPanel: React.FC<PaperAbilityScoresPanelProps> = ({
  character,
  setRollResult,
  onDiceRoll,
}) => {
  const handleAbilityClick = (abilityKey: string, abilityName: string) => {
    const ability = character.abilities[abilityKey as keyof typeof character.abilities];
    const roll = createAbilityRoll(abilityKey, ability.score);

    // Update this when dice box returns results
    setRollResult({
      text: `${abilityName} Check: 1d20${roll.modifier >= 0 ? '+' : ''}${roll.modifier}`,
      value: null,
    });

    onDiceRoll(roll);
  };

  return (
    <div
      className="relative w-full h-[300px] bg-contain bg-no-repeat bg-center"
      style={{ backgroundImage: 'url(/assets/AbilityScores.webp)' }}
    >
      {/* 2x3 Grid for abilities */}
      <div className="grid grid-rows-2 grid-cols-3 gap-y-2 w-full h-full">
        {ABILITIES.map(({ key, name, row, col }) => {
          const ability = character.abilities[key as keyof typeof character.abilities];
          const modifier = ability.modifier;

          return (
            <button
              key={key}
              onClick={() => handleAbilityClick(key, name)}
              className="relative flex items-center justify-center hover:opacity-80 transition-opacity group"
              title={`Roll ${name} check`}
            >
              {/* Modifier in badge */}
              <div className="absolute -translate-x-1/2"
                  style={{
                    top: row === 0 ? '16%' : '5%',
                    left: col === 0 ? '60%' : col === 2 ? '40%' : '50%'
                  }}
              >
                <span className="homemade-apple-regular text-3xl text-green-500 font-bold">
                  {modifier >= 0 ? '+' : ''}{modifier}
                </span>
              </div>

              {/* Score in scroll */}
              <div className="absolute -translate-x-1/2"
                style={{
                  top: row === 0 ? '45%' : '41%',
                  left: col === 0 ? '60%' : col === 2 ? '40%' : '50%'
                }}
              >
                <span className="homemade-apple-regular text-5xl text-[#1e140a]">
                  {ability.score}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
