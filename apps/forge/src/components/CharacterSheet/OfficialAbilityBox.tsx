import React, { useState } from 'react';
import { AbilityName } from '../../types/dnd';
import { createAbilityRoll, createAdvantageRoll, createDisadvantageRoll, DiceRoll } from '../../services/diceService';
import { formatModifier } from '../../utils/formatters';

interface OfficialAbilityBoxProps {
  name: AbilityName;
  ability: { score: number; modifier: number };
  setRollResult: (result: {
    text: string;
    value: number | null;
    details?: Array<{ value: number; kept: boolean; critical?: 'success' | 'failure' }>
  }) => void;
  onDiceRoll: (roll: DiceRoll) => void;
}

type RollType = 'normal' | 'advantage' | 'disadvantage';

/**
 * OfficialAbilityBox - Compact vertical ability display matching official D&D 5e sheet
 *
 * Layout:
 * ┌────────────┐
 * │   +3       │ ← Modifier badge (brown bg)
 * ├────────────┤
 * │            │
 * │     16     │ ← Score (large, bold)
 * │            │
 * └────────────┘
 *      STR       ← Label
 */
export const OfficialAbilityBox: React.FC<OfficialAbilityBoxProps> = ({
  name,
  ability,
  setRollResult,
  onDiceRoll,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [rollType, setRollType] = useState<RollType>('normal');

  const handleRoll = (type: RollType = rollType) => {
    let roll;
    switch (type) {
      case 'advantage':
        roll = createAdvantageRoll(`${name} Check`, ability.modifier);
        break;
      case 'disadvantage':
        roll = createDisadvantageRoll(`${name} Check`, ability.modifier);
        break;
      default:
        roll = createAbilityRoll(name, ability.score);
    }

    // Create detailed results for display
    const details = roll.pools && roll.pools.length > 0
      ? roll.pools[0].results.map((value) => ({
          value,
          kept: roll.diceResults.includes(value),
          critical: roll.diceResults.length === 1 && roll.diceResults[0] === value ? roll.critical : undefined
        }))
      : roll.diceResults.map((value) => ({
          value,
          kept: true,
          critical: roll.diceResults.length === 1 ? roll.critical : undefined
        }));

    setRollResult({
      text: `${roll.label}: ${roll.notation}`,
      value: roll.total,
      details
    });
    onDiceRoll(roll);
    setShowMenu(false);
  };

  const getRollIcon = () => {
    switch (rollType) {
      case 'advantage': return 'A';
      case 'disadvantage': return 'D';
      default: return null;
    }
  };

  return (
    <div className="relative flex flex-col items-center">
      <button
        onClick={() => handleRoll()}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowMenu(!showMenu);
        }}
        className="flex flex-col items-center group cursor-pointer relative"
        title={`Roll ${name} check (${rollType}) - Right-click for options`}
      >
        {/* Modifier badge on top */}
        <div className="bg-[#8b4513] text-[#fcf6e3] px-4 py-1 text-lg font-bold border-2 border-[#1e140a] rounded-sm text-center mb-[-2px] z-10 font-cinzel relative group-hover:bg-[#a0522d] transition-colors">
          {formatModifier(ability.modifier)}
          {/* Roll indicator */}
          {getRollIcon() && (
            <div className="absolute -top-2 -right-2 w-5 h-5 bg-[#228b22] rounded-full flex items-center justify-center shadow-md border border-[#1e140a]">
              <span className="text-xs font-bold text-[#fcf6e3]">{getRollIcon()}</span>
            </div>
          )}
        </div>

        {/* Score box */}
        <div className="w-20 h-20 border-2 border-[#1e140a] bg-[#fcf6e3] flex items-center justify-center rounded-sm shadow-md group-hover:border-[#8b4513] transition-colors">
          <span className="text-3xl font-bold text-[#1e140a] font-eb-garamond">{ability.score}</span>
        </div>

        {/* Ability label */}
        <div className="text-xs font-cinzel font-bold text-[#3d2817] uppercase mt-1.5 tracking-wide">
          {name}
        </div>
      </button>

      {/* Right-click menu */}
      {showMenu && (
        <div className="absolute top-full left-0 mt-1 bg-[#f5ebd2] border-2 border-[#1e140a] rounded-sm shadow-lg z-50 min-w-32">
          <button
            onClick={() => {
              setRollType('normal');
              handleRoll('normal');
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-[#8b4513] hover:text-[#fcf6e3] first:rounded-t-sm font-eb-garamond text-[#3d2817]"
          >
            Normal
          </button>
          <button
            onClick={() => {
              setRollType('advantage');
              handleRoll('advantage');
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-[#8b4513] hover:text-[#fcf6e3] text-[#228b22] font-eb-garamond font-semibold"
          >
            Advantage
          </button>
          <button
            onClick={() => {
              setRollType('disadvantage');
              handleRoll('disadvantage');
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-[#8b4513] hover:text-[#fcf6e3] text-[#8b0000] font-eb-garamond font-semibold last:rounded-b-sm"
          >
            Disadvantage
          </button>
        </div>
      )}

      {/* Click outside to close menu */}
      {showMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowMenu(false)}
        />
      )}
    </div>
  );
};
