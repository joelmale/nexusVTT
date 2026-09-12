import React, { useState } from 'react';
import { Character, AbilityName } from '../../types/dnd';
import { createSavingThrowRoll, createAdvantageRoll, createDisadvantageRoll, DiceRoll } from '../../services/diceService';
import { formatModifier } from '../../utils/formatters';
import { loadClasses } from '../../services/dataService';
import type { LayoutMode } from './AbilityScores';

interface SavingThrowsProps {
  character: Character;
  setRollResult: (result: {
    text: string;
    value: number | null;
    details?: Array<{ value: number; kept: boolean; critical?: 'success' | 'failure' }>
  }) => void;
  onDiceRoll: (roll: DiceRoll) => void;
  onUpdateCharacter?: (character: Character) => void;
  layoutMode?: LayoutMode;
}

type RollType = 'normal' | 'advantage' | 'disadvantage';

export const SavingThrows: React.FC<SavingThrowsProps> = ({
  character,
  setRollResult,
  onDiceRoll,
  onUpdateCharacter: _onUpdateCharacter,
  layoutMode = 'modern',
}) => {
  const [activeMenuAbility, setActiveMenuAbility] = useState<AbilityName | null>(null);
  const [rollTypes, setRollTypes] = useState<Record<AbilityName, RollType>>({
    STR: 'normal',
    DEX: 'normal',
    CON: 'normal',
    INT: 'normal',
    WIS: 'normal',
    CHA: 'normal',
  });

  // Load class data to get saving throw proficiencies
  const CLASSES_DATABASE = loadClasses();
  const classData = CLASSES_DATABASE.find(c => c.slug === character.class);
  const savingThrowProficiencies = classData?.save_throws || [];

  const hasGnomishCunning = character.featuresAndTraits?.speciesTraits?.includes('Gnomish Cunning');

  const abilities: AbilityName[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

  const handleRoll = (abilityName: AbilityName, type: RollType = rollTypes[abilityName]) => {
    const ability = character.abilities[abilityName];
    const isProficient = savingThrowProficiencies.includes(abilityName);

    let roll;
    const saveModifier = ability.modifier + (isProficient ? character.proficiencyBonus : 0);

    switch (type) {
      case 'advantage':
        roll = createAdvantageRoll(`${abilityName} Save`, saveModifier);
        break;
      case 'disadvantage':
        roll = createDisadvantageRoll(`${abilityName} Save`, saveModifier);
        break;
      default:
        roll = createSavingThrowRoll(abilityName, ability.modifier, character.proficiencyBonus, isProficient);
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
    setActiveMenuAbility(null);
  };

  const getRollIcon = (abilityName: AbilityName) => {
    switch (rollTypes[abilityName]) {
      case 'advantage': return 'A';
      case 'disadvantage': return 'D';
      default: return null;
    }
  };

  // Paper Sheet layout: Badge-style 2x3 grid
  if (layoutMode === 'paper-sheet') {
    return (
      <div className="grid grid-cols-2 gap-2">
        {abilities.map((abilityName) => {
          const ability = character.abilities[abilityName];
          const isProficient = savingThrowProficiencies.includes(abilityName);
          const saveModifier = ability.modifier + (isProficient ? character.proficiencyBonus : 0);
          const isMenuOpen = activeMenuAbility === abilityName;
          const hasAdvantage = hasGnomishCunning && ['INT', 'WIS', 'CHA'].includes(abilityName);
          const badge = hasAdvantage ? (
            <span
              className="ml-2 px-2 py-0.5 rounded-full text-[10px] uppercase bg-amber-800 text-amber-100"
              title="Gnomish Cunning: advantage on INT/WIS/CHA saves"
            >
              Adv
            </span>
          ) : null;

          return (
            <div key={abilityName} className="relative">
              <button
                onClick={() => handleRoll(abilityName)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setActiveMenuAbility(isMenuOpen ? null : abilityName);
                }}
                className="flex items-center justify-between p-2 bg-[#f5ebd2] hover:bg-[#ebe1c8] rounded-sm border border-[#1e140a]/20 transition-colors cursor-pointer w-full group relative"
                title={`Roll ${abilityName} saving throw (${rollTypes[abilityName]}) - Right-click for options`}
              >
                <div className="flex items-center gap-2">
                  {/* Proficiency indicator dot */}
                  {isProficient && (
                    <div className="w-2 h-2 rounded-full bg-[#8b4513]" />
                  )}
                  {/* Roll indicator */}
                  {getRollIcon(abilityName) && (
                    <span className="text-xs font-bold text-[#228b22]">{getRollIcon(abilityName)}</span>
                  )}
                  {/* Ability name */}
                  <span className="text-sm font-cinzel font-semibold text-[#3d2817]">
                    {abilityName}
                  </span>
                  {badge}
                </div>
                {/* Save bonus */}
                <span className="text-lg font-cinzel font-bold text-[#1e140a] tabular-nums">
                  {formatModifier(saveModifier)}
                </span>
              </button>

              {/* Roll type menu */}
              {isMenuOpen && (
                <>
                  <div className="absolute top-full left-0 mt-1 bg-[#f5ebd2] border-2 border-[#1e140a] rounded-sm shadow-lg z-50 min-w-32">
                    <button
                      onClick={() => {
                        setRollTypes({ ...rollTypes, [abilityName]: 'normal' });
                        handleRoll(abilityName, 'normal');
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[#8b4513] hover:text-[#fcf6e3] first:rounded-t-sm font-eb-garamond text-[#3d2817]"
                    >
                      Normal
                    </button>
                    <button
                      onClick={() => {
                        setRollTypes({ ...rollTypes, [abilityName]: 'advantage' });
                        handleRoll(abilityName, 'advantage');
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[#8b4513] hover:text-[#fcf6e3] text-[#228b22] font-eb-garamond font-semibold"
                    >
                      Advantage
                    </button>
                    <button
                      onClick={() => {
                        setRollTypes({ ...rollTypes, [abilityName]: 'disadvantage' });
                        handleRoll(abilityName, 'disadvantage');
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[#8b4513] hover:text-[#fcf6e3] text-[#8b0000] font-eb-garamond font-semibold last:rounded-b-sm"
                    >
                      Disadvantage
                    </button>
                  </div>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setActiveMenuAbility(null)}
                  />
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Classic layout: Compact list similar to skills
  if (layoutMode === 'classic') {
    return (
      <div className="space-y-3">
        {/* Saving Throws List */}
        <div className="space-y-1">
          {abilities.map((abilityName) => {
            const ability = character.abilities[abilityName];
            const isProficient = savingThrowProficiencies.includes(abilityName);
            const saveModifier = ability.modifier + (isProficient ? character.proficiencyBonus : 0);
            const isMenuOpen = activeMenuAbility === abilityName;

            return (
              <div key={abilityName} className="relative">
                <button
                  onClick={() => handleRoll(abilityName)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setActiveMenuAbility(isMenuOpen ? null : abilityName);
                  }}
                  className="flex items-center justify-between px-2 py-1 hover:bg-theme-tertiary rounded transition-colors cursor-pointer w-full group"
                  title={`Roll ${abilityName} saving throw (${rollTypes[abilityName]}) - Right-click for options`}
                >
                  <div className="flex items-center gap-1.5">
                    {/* Proficiency bubble */}
                    <div className={`w-3 h-3 rounded-full border ${isProficient ? 'bg-accent-yellow border-yellow-500' : 'border-gray-500'}`} />
                    {/* Roll indicator */}
                    {getRollIcon(abilityName) && (
                      <span className="text-xs font-bold text-accent-green-light">{getRollIcon(abilityName)}</span>
                    )}
                    <span className="text-xs font-medium text-theme-tertiary group-hover:text-theme-primary">{abilityName}</span>
                  </div>
                  <span className="font-mono text-sm font-bold text-accent-yellow-light">{formatModifier(saveModifier)}</span>
                </button>

                {/* Roll type menu */}
                {isMenuOpen && (
                  <>
                    <div className="absolute top-full left-0 mt-1 bg-theme-secondary border border-theme-primary rounded-lg shadow-lg z-50 min-w-32">
                      <button
                        onClick={() => {
                          setRollTypes({ ...rollTypes, [abilityName]: 'normal' });
                          handleRoll(abilityName, 'normal');
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-theme-tertiary first:rounded-t-lg"
                      >
                        Normal
                      </button>
                      <button
                        onClick={() => {
                          setRollTypes({ ...rollTypes, [abilityName]: 'advantage' });
                          handleRoll(abilityName, 'advantage');
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-theme-tertiary text-accent-green-light"
                      >
                        Advantage
                      </button>
                      <button
                        onClick={() => {
                          setRollTypes({ ...rollTypes, [abilityName]: 'disadvantage' });
                          handleRoll(abilityName, 'disadvantage');
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-theme-tertiary text-accent-red-light last:rounded-b-lg"
                      >
                        Disadvantage
                      </button>
                    </div>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setActiveMenuAbility(null)}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Modern layout: Card-style with more spacing
  return (
    <div className="space-y-4">
      {/* Saving Throws Grid */}
      <div className="grid grid-cols-2 gap-2">
        {abilities.map((abilityName) => {
          const ability = character.abilities[abilityName];
          const isProficient = savingThrowProficiencies.includes(abilityName);
          const saveModifier = ability.modifier + (isProficient ? character.proficiencyBonus : 0);
          const isMenuOpen = activeMenuAbility === abilityName;
          const hasAdvantage = hasGnomishCunning && ['INT', 'WIS', 'CHA'].includes(abilityName);
          const badge = hasAdvantage ? (
            <span
              className="ml-2 px-2 py-0.5 rounded-full text-[10px] uppercase bg-amber-800 text-amber-100"
              title="Gnomish Cunning: advantage on INT/WIS/CHA saves"
            >
              Adv
            </span>
          ) : null;

          return (
            <div key={abilityName} className="relative">
              <button
                onClick={() => handleRoll(abilityName)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setActiveMenuAbility(isMenuOpen ? null : abilityName);
                }}
                className="flex items-center justify-between p-2 bg-theme-tertiary/50 hover:bg-accent-red-dark/70 rounded transition-colors cursor-pointer w-full"
                title={`Roll ${abilityName} saving throw (${rollTypes[abilityName]}) - Right-click for options`}
              >
                <div className="flex items-center gap-2">
                  {isProficient && (
                    <div className="w-2 h-2 rounded-full bg-accent-yellow" />
                  )}
                  {getRollIcon(abilityName) && (
                    <span className="text-xs font-bold text-accent-green-light">{getRollIcon(abilityName)}</span>
                  )}
                  <span className="text-sm font-semibold text-theme-primary">{abilityName}</span>
                  {badge}
                </div>
                <span className="font-mono text-lg font-bold text-accent-yellow-light">{formatModifier(saveModifier)}</span>
              </button>

              {/* Roll type menu */}
              {isMenuOpen && (
                <>
                  <div className="absolute top-full left-0 mt-1 bg-theme-secondary border border-theme-primary rounded-lg shadow-lg z-50 min-w-32">
                    <button
                      onClick={() => {
                        setRollTypes({ ...rollTypes, [abilityName]: 'normal' });
                        handleRoll(abilityName, 'normal');
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-theme-tertiary first:rounded-t-lg"
                    >
                      Normal
                    </button>
                    <button
                      onClick={() => {
                        setRollTypes({ ...rollTypes, [abilityName]: 'advantage' });
                        handleRoll(abilityName, 'advantage');
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-theme-tertiary text-accent-green-light"
                    >
                      Advantage
                    </button>
                    <button
                      onClick={() => {
                        setRollTypes({ ...rollTypes, [abilityName]: 'disadvantage' });
                        handleRoll(abilityName, 'disadvantage');
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-theme-tertiary text-accent-red-light last:rounded-b-lg"
                    >
                      Disadvantage
                    </button>
                  </div>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setActiveMenuAbility(null)}
                  />
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
