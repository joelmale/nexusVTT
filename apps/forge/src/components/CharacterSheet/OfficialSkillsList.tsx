import React, { useState } from 'react';
import { Character, SkillName } from '../../types/dnd';
import { createSkillRoll, createAdvantageRoll, createDisadvantageRoll, DiceRoll } from '../../services/diceService';
import { formatModifier } from '../../utils/formatters';

interface OfficialSkillsListProps {
  character: Character;
  setRollResult: (result: {
    text: string;
    value: number | null;
    details?: Array<{ value: number; kept: boolean; critical?: 'success' | 'failure' }>
  }) => void;
  onDiceRoll: (roll: DiceRoll) => void;
}

type RollType = 'normal' | 'advantage' | 'disadvantage';

interface SkillRowProps {
  name: SkillName;
  skill: { value: number; proficient: boolean; expertise?: boolean };
  setRollResult: (result: {
    text: string;
    value: number | null;
    details?: Array<{ value: number; kept: boolean; critical?: 'success' | 'failure' }>
  }) => void;
  onDiceRoll: (roll: DiceRoll) => void;
}

const SkillRow: React.FC<SkillRowProps> = ({ name, skill, setRollResult, onDiceRoll }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [rollType, setRollType] = useState<RollType>('normal');

  // Format skill name (e.g., "AnimalHandling" -> "Animal Handling")
  const skillLabel = name.replace(/([A-Z])/g, ' $1').trim();

  const handleRoll = (type: RollType = rollType) => {
    let roll;
    switch (type) {
      case 'advantage':
        roll = createAdvantageRoll(skillLabel, skill.value);
        break;
      case 'disadvantage':
        roll = createDisadvantageRoll(skillLabel, skill.value);
        break;
      default:
        roll = createSkillRoll(skillLabel, skill.value);
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
    <div className="relative">
      <button
        onClick={() => handleRoll()}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowMenu(!showMenu);
        }}
        className="flex items-center gap-2 px-2 py-0.5 hover:bg-[#8b4513]/10 rounded-sm transition-colors cursor-pointer w-full group"
        title={`Roll ${skillLabel} check (${rollType}) - Right-click for options`}
      >
        {/* Proficiency circle */}
        <div className="w-3.5 h-3.5 rounded-full border-2 border-[#1e140a] flex items-center justify-center flex-shrink-0 bg-[#fcf6e3]">
          {skill.expertise ? (
            // Double-filled for expertise (◉)
            <>
              <div className="w-2.5 h-2.5 rounded-full bg-[#1e140a]" />
              <div className="absolute w-1 h-1 rounded-full bg-[#fcf6e3]" />
            </>
          ) : skill.proficient ? (
            // Filled for proficiency (●)
            <div className="w-2.5 h-2.5 rounded-full bg-[#1e140a]" />
          ) : null}
        </div>

        {/* Roll indicator */}
        {getRollIcon() && (
          <span className="text-xs font-bold text-[#228b22]">{getRollIcon()}</span>
        )}

        {/* Skill name */}
        <span className="flex-1 text-left text-[11px] homemade-apple-regular text-[#3d2817] group-hover:text-[#1e140a]">
          {skillLabel}
        </span>

        {/* Skill bonus */}
        <span className="text-sm font-bold font-cinzel text-[#3d2817] tabular-nums">
          {formatModifier(skill.value)}
        </span>
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

/**
 * OfficialSkillsList - Traditional vertical skills list matching official D&D 5e sheet
 *
 * Features:
 * - Single column layout (18 skills)
 * - Proficiency circles (○ empty, ● filled, ◉ expertise)
 * - Click to roll
 * - Bonus displayed on right
 */
export const OfficialSkillsList: React.FC<OfficialSkillsListProps> = ({
  character,
  setRollResult,
  onDiceRoll,
}) => {
  const skills = Object.entries(character.skills) as [SkillName, { value: number; proficient: boolean; expertise?: boolean }][];

  return (
    <div className="space-y-0.5">
      {skills.sort((a, b) => a[0].localeCompare(b[0])).map(([name, skill]) => (
        <SkillRow
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
