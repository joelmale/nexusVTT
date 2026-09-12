import React, { useState } from 'react';
import { SkillName } from '../../types/dnd';
import { createSkillRoll, createAdvantageRoll, createDisadvantageRoll, DiceRoll } from '../../services/diceService';
import { formatModifier } from '../../utils/formatters';
import type { LayoutMode } from './AbilityScores';

// Skill descriptions for tooltips
const SKILL_DESCRIPTIONS: Record<SkillName, string> = {
  Acrobatics: "Your Dexterity (Acrobatics) check covers your attempt to stay on your feet in a tricky situation, such as when you're trying to run across a sheet of ice, balance on a tightrope, or stay upright on a rocking ship's deck.",
  AnimalHandling: "When there is any question whether you can calm down a domesticated animal, keep a mount from getting spooked, or intuit an animal's intentions, the DM might call for a Wisdom (Animal Handling) check.",
  Arcana: "Your Intelligence (Arcana) check measures your ability to recall lore about spells, magic items, eldritch symbols, magical traditions, the planes of existence, and the inhabitants of those planes.",
  Athletics: "Your Strength (Athletics) check covers difficult situations you encounter while climbing, jumping, or swimming. Examples include the following activities: You attempt to climb a sheer or slippery cliff, avoid hazards while swimming, or break free of bonds.",
  Deception: "Your Charisma (Deception) check determines whether you can convincingly hide the truth, either verbally or through your actions. This deception can encompass everything from misleading others through ambiguity to telling outright lies.",
  History: "Your Intelligence (History) check measures your ability to recall lore about historical events, legendary people, ancient kingdoms, past disputes, recent wars, and lost civilizations.",
  Insight: "Your Wisdom (Insight) check decides whether you can determine the true intentions of a creature, such as when searching out a lie or predicting someone's next move. Doing so involves gleaning clues from body language, speech habits, and changes in mannerisms.",
  Intimidation: "When you attempt to influence someone through overt threats, hostile actions, and physical violence, the DM might ask you to make a Charisma (Intimidation) check.",
  Investigation: "When you look around for clues and make deductions based on those clues, you make an Intelligence (Investigation) check. You might deduce the location of a hidden object, discern from the appearance of a wound what kind of weapon dealt it, or determine the weakest point in a tunnel that could cause it to collapse.",
  Medicine: "A Wisdom (Medicine) check lets you try to stabilize a dying companion or diagnose an illness. Medicine doesn't normally restore hit points, but it can prevent death or restore a creature to consciousness.",
  Nature: "Your Intelligence (Nature) check measures your ability to recall lore about terrain, plants and animals, the weather, and natural cycles. You might identify the signs that owlbears live nearby, know how to find clean water in the desert, or predict the next storm.",
  Perception: "Your Wisdom (Perception) check lets you spot, hear, or otherwise detect the presence of something. It measures your general awareness of your surroundings and the keenness of your senses.",
  Performance: "Your Charisma (Performance) check determines how well you can delight an audience with music, dance, acting, storytelling, or some other form of entertainment.",
  Persuasion: "When you attempt to influence someone or a group of people with tact, social graces, or good nature, the DM might ask you to make a Charisma (Persuasion) check.",
  Religion: "Your Intelligence (Religion) check measures your ability to recall lore about deities, rites and prayers, religious hierarchies, holy symbols, and the practices of secret cults.",
  SleightOfHand: "Whenever you attempt an act of legerdemain or manual trickery, such as planting something on someone else or concealing an object on your person, make a Dexterity (Sleight of Hand) check.",
  Stealth: "Make a Dexterity (Stealth) check when you attempt to conceal yourself from enemies, slink past guards, slip away without being noticed, or sneak up on someone without being seen or heard.",
  Survival: "The DM might ask you to make a Wisdom (Survival) check to follow tracks, hunt wild game, guide a group safely through frozen wastelands, identify signs that owlbears live nearby, predict the weather, or avoid quicksand and other natural hazards."
};

interface SkillEntryProps {
  name: SkillName;
  skill: { value: number; proficient: boolean; expertise?: boolean };
  setRollResult: (result: {
    text: string;
    value: number | null;
    details?: Array<{ value: number; kept: boolean; critical?: 'success' | 'failure' }>
  }) => void;
  onDiceRoll: (roll: DiceRoll) => void;
  layoutMode?: LayoutMode;
}

type RollType = 'normal' | 'advantage' | 'disadvantage';

export const SkillEntry: React.FC<SkillEntryProps> = ({
  name,
  skill,
  setRollResult,
  onDiceRoll,
  layoutMode = 'modern',
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [rollType, setRollType] = useState<RollType>('normal');
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
      ? roll.pools[0].results.map((value, _idx) => ({
          value,
          kept: roll.diceResults.includes(value),
          critical: roll.diceResults.length === 1 && roll.diceResults[0] === value ? roll.critical : undefined
        }))
      : roll.diceResults.map((value, _idx) => ({
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

  // Classic layout: Compact, traditional D&D skill checklist
  if (layoutMode === 'classic-dnd') {
    return (
      <div className="relative">
        <button
          onClick={() => handleRoll()}
          onContextMenu={(e) => {
            e.preventDefault();
            setShowMenu(!showMenu);
          }}
          className="flex items-center justify-between px-2 py-1 hover:bg-theme-tertiary rounded transition-colors cursor-pointer w-full group"
          title={`${SKILL_DESCRIPTIONS[name]}\n\nRoll ${skillLabel} check (${rollType}) - Right-click for options`}
        >
          <div className="flex items-center gap-1.5">
             {/* Proficiency bubble */}
             <div className={`w-3 h-3 rounded-full border ${skill.proficient ? 'bg-accent-yellow border-yellow-500' : 'border-gray-500'}`} />
             {/* Expertise indicator */}
             {skill.expertise && (
               <span className="text-amber-400 text-xs" title="Expertise: Proficiency bonus doubled">⭐</span>
             )}
             {/* Roll indicator */}
             {getRollIcon() && (
               <span className="text-xs font-bold text-accent-green-light">{getRollIcon()}</span>
             )}
             <span className="text-xs font-medium text-theme-tertiary group-hover:text-theme-primary">{skillLabel}</span>
           </div>
          <span className="font-mono text-sm font-bold text-accent-yellow-light">{formatModifier(skill.value)}</span>
        </button>

        {showMenu && (
          <div className="absolute top-full left-0 mt-1 bg-theme-secondary border border-theme-primary rounded-lg shadow-lg z-50 min-w-32">
            <button
              onClick={() => {
                setRollType('normal');
                handleRoll('normal');
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-theme-tertiary first:rounded-t-lg"
            >
              Normal
            </button>
            <button
              onClick={() => {
                setRollType('advantage');
                handleRoll('advantage');
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-theme-tertiary text-accent-green-light"
            >
              Advantage
            </button>
            <button
              onClick={() => {
                setRollType('disadvantage');
                handleRoll('disadvantage');
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-theme-tertiary text-accent-red-light last:rounded-b-lg"
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
  }

  // Modern layout: Badge style
  return (
    <div className="relative">
      <button
        onClick={() => handleRoll()}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowMenu(!showMenu);
        }}
        className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all cursor-pointer w-full text-sm font-medium ${
          skill.proficient
            ? 'bg-yellow-900/30 border-yellow-500/50 text-accent-yellow-light hover:bg-yellow-900/50 hover:border-yellow-400'
            : 'bg-theme-secondary/50 border-theme-primary text-theme-tertiary hover:bg-theme-tertiary hover:border-gray-500 hover:text-theme-primary'
        }`}
        title={`${SKILL_DESCRIPTIONS[name]}\n\nRoll ${skillLabel} check (${rollType}) - Right-click for options`}
      >
        <div className="flex items-center gap-2">
           {getRollIcon() && (
             <span className="text-xs font-bold text-accent-green-light">{getRollIcon()}</span>
           )}
           <span className="truncate">
             {skillLabel}
           </span>
           {/* Proficiency indicator */}
           {skill.proficient && !skill.expertise && (
             <span className="text-accent-yellow-light">●</span>
           )}
           {/* Expertise indicator */}
           {skill.expertise && (
             <span className="text-amber-400" title="Expertise: Proficiency bonus doubled">⭐</span>
           )}
         </div>
        <span className="font-mono font-bold text-accent-yellow-light ml-1">{formatModifier(skill.value)}</span>
      </button>

      {showMenu && (
        <div className="absolute top-full left-0 mt-1 bg-theme-secondary border border-theme-primary rounded-lg shadow-lg z-50 min-w-32">
          <button
            onClick={() => {
              setRollType('normal');
              handleRoll('normal');
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-theme-tertiary first:rounded-t-lg"
          >
            Normal
          </button>
          <button
            onClick={() => {
              setRollType('advantage');
              handleRoll('advantage');
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-theme-tertiary text-accent-green-light"
          >
            Advantage
          </button>
          <button
            onClick={() => {
              setRollType('disadvantage');
              handleRoll('disadvantage');
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-theme-tertiary text-accent-red-light last:rounded-b-lg"
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