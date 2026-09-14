import React, { useState } from 'react';
import { Shield, Dice6, Footprints, Plus } from 'lucide-react';
import { Character } from '../../types/dnd';
import { createInitiativeRoll, createAdvantageRoll, createDisadvantageRoll, DiceRoll } from '../../services/diceService';
import { formatModifier } from '../../utils/formatters';
import { loadEquipment } from '../../services/dataService';
import { HitDice } from './HitDice';
import { DeathSaves } from './DeathSaves';

interface CombatStatsPanelProps {
  character: Character;
  setRollResult: (result: {
    text: string;
    value: number | null;
    details?: Array<{ value: number; kept: boolean; critical?: 'success' | 'failure' }>
  }) => void;
  onDiceRoll: (roll: DiceRoll) => void;
  onUpdateCharacter: (character: Character) => void;
  layoutMode?: 'paper-sheet' | 'classic-dnd' | 'modern';
}

type RollType = 'normal' | 'advantage' | 'disadvantage';

export const CombatStatsPanel: React.FC<CombatStatsPanelProps> = ({
  character,
  setRollResult,
  onDiceRoll,
  onUpdateCharacter,
  layoutMode = 'paper-sheet',
}) => {
  const [initiativeRollType, setInitiativeRollType] = useState<RollType>('normal');
  const [tempHpInput, setTempHpInput] = useState('');

  const handleInitiativeRoll = (type: RollType = initiativeRollType) => {
    let roll;
    switch (type) {
      case 'advantage':
        roll = createAdvantageRoll('Initiative', character.initiative);
        break;
      case 'disadvantage':
        roll = createDisadvantageRoll('Initiative', character.initiative);
        break;
      default:
        roll = createInitiativeRoll(character.initiative);
    }

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
  };

  const getSpeed = () => {
    return character.speed;
  };



  const handleRemoveTempHp = () => {
    onUpdateCharacter({
      ...character,
      temporaryHitPoints: 0
    });
  };

  const handleAddTempHp = () => {
    const amount = parseInt(tempHpInput);
    if (isNaN(amount) || amount <= 0) return;

    const currentTempHp = character.temporaryHitPoints || 0;
    const newTempHp = currentTempHp + amount;

    onUpdateCharacter({
      ...character,
      temporaryHitPoints: newTempHp
    });
    setTempHpInput('');
  };

  const handleCurrentHpChange = (delta: number) => {
    const newHp = Math.max(0, Math.min(character.maxHitPoints, character.hitPoints + delta));
    onUpdateCharacter({
      ...character,
      hitPoints: newHp
    });
  };

  const handleTempHpChange = (delta: number) => {
    const currentTempHp = character.temporaryHitPoints || 0;
    const newTempHp = Math.max(0, currentTempHp + delta);
    onUpdateCharacter({
      ...character,
      temporaryHitPoints: newTempHp
    });
  };

  const getACBreakdown = () => {
    const parts = [];
    let total = 0;

    // Get equipped armor details
    const equippedArmor = character.equippedArmor
      ? loadEquipment().find(eq => eq.slug === character.equippedArmor)
      : null;

    // Get equipped shield
    const equippedShield = character.equippedWeapons?.find(slug => {
      const item = loadEquipment().find(eq => eq.slug === slug);
      return item?.equipment_category === 'Armor' && item.armor_category === 'Shield';
    });

    const dexMod = character.abilities.DEX.modifier;

    // Calculate AC based on armor type (D&D 5e rules)
    if (equippedArmor && equippedArmor.armor_class) {
      if (equippedArmor.armor_category === 'Heavy') {
        // Heavy armor: Flat AC score, no DEX modifier
        parts.push(`${equippedArmor.name}: ${equippedArmor.armor_class.base}`);
        total = equippedArmor.armor_class.base;
      } else if (equippedArmor.armor_category === 'Medium') {
        // Medium armor: Base AC + DEX modifier (maximum +2)
        const dexBonus = Math.min(dexMod, equippedArmor.armor_class.max_bonus || 2);
        parts.push(`${equippedArmor.name}: ${equippedArmor.armor_class.base}`);
        total = equippedArmor.armor_class.base;
        if (dexBonus !== 0) {
          parts.push(`DEX: ${dexBonus >= 0 ? '+' : ''}${dexBonus}`);
          total += dexBonus;
        }
      } else if (equippedArmor.armor_category === 'Light') {
        // Light armor: Base AC + full DEX modifier
        parts.push(`${equippedArmor.name}: ${equippedArmor.armor_class.base}`);
        total = equippedArmor.armor_class.base;
        if (dexMod !== 0) {
          parts.push(`DEX: ${dexMod >= 0 ? '+' : ''}${dexMod}`);
          total += dexMod;
        }
      }
    } else {
      // Unarmored: Base 10 + full DEX modifier
      parts.push(`Base: 10`);
      total = 10;
      if (dexMod !== 0) {
        parts.push(`DEX: ${dexMod >= 0 ? '+' : ''}${dexMod}`);
        total += dexMod;
      }
    }

    // Shield contribution (always +2, stacks with everything)
    if (equippedShield) {
      parts.push(`Shield: +2`);
      total += 2;
    }

    return [`${parts.join(', ')} = ${total} AC`];
  };

  // Determine color scheme based on layout mode
  const isPaperSheet = layoutMode === 'paper-sheet';
  const bgClass = isPaperSheet ? 'bg-[#f5ebd2]' : 'bg-theme-tertiary/50';
  const hoverBgClass = isPaperSheet ? 'hover:bg-[#ebe1c8]' : 'hover:bg-theme-hover';
  const borderClass = isPaperSheet ? 'border-[#1e140a]/20' : 'border-theme-secondary';
  const textPrimaryClass = isPaperSheet ? 'text-[#1e140a]' : 'text-theme-primary';
  const textSecondaryClass = isPaperSheet ? 'text-[#3d2817]' : 'text-theme-tertiary';
  const textBrownClass = isPaperSheet ? 'text-[#8b4513]' : 'text-accent-blue';
  const iconClass = isPaperSheet ? 'text-[#8b4513]' : 'text-theme-muted';
  const inputBgClass = isPaperSheet ? 'bg-[#fcf6e3]' : 'bg-theme-quaternary';
  const inputTextClass = isPaperSheet ? 'text-[#1e140a]' : 'text-theme-primary';
  const inputBorderClass = isPaperSheet ? 'border-[#1e140a]/20' : 'border-theme-muted';
  const inputFocusBorderClass = isPaperSheet ? 'focus:border-[#8b4513]' : 'focus:border-accent-blue';
  const buttonRedBgClass = isPaperSheet ? 'bg-[#8b0000]' : 'bg-accent-red';
  const buttonRedHoverClass = isPaperSheet ? 'hover:bg-red-700' : 'hover:bg-red-600';
  const buttonGreenBgClass = isPaperSheet ? 'bg-[#228b22]' : 'bg-accent-green';
  const buttonGreenHoverClass = isPaperSheet ? 'hover:bg-green-700' : 'hover:bg-green-600';
  const buttonBrownBgClass = isPaperSheet ? 'bg-[#8b4513]' : 'bg-accent-blue';
  const buttonBrownHoverClass = isPaperSheet ? 'hover:bg-[#a0522d]' : 'hover:bg-blue-600';
  const hpGreenClass = isPaperSheet ? 'text-[#228b22]' : 'text-accent-green';
  const hpTextClass = isPaperSheet ? 'text-[#fcf6e3]' : 'text-white';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-theme-border">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-accent-red" />
          <h2 className="text-xl font-bold">Combat Stats</h2>
        </div>
        <div className={`text-[11px] uppercase tracking-[0.16em] font-semibold ${
          isPaperSheet ? 'text-[#3d2817]' : 'text-theme-muted'
        }`}>
          Survivability
        </div>
      </div>

      {/* Top Row - AC, Initiative, Speed */}
      <div className="grid grid-cols-3 gap-3">
        {/* Armor Class */}
        <div
          className={`flex flex-col items-center ${bgClass} p-3 rounded-sm border ${borderClass} cursor-help`}
          title={getACBreakdown().join('\n')}
        >
          <Shield className={`w-5 h-5 ${iconClass} mb-1`} />
          <span className={`text-xs font-cinzel font-semibold ${textSecondaryClass} uppercase`}>AC</span>
          <div className={`text-3xl font-cinzel font-extrabold ${textPrimaryClass}`}>{character.armorClass}</div>
        </div>

        {/* Initiative */}
        <div className="relative">
          <button
            onClick={() => handleInitiativeRoll()}
            onContextMenu={(e) => {
              e.preventDefault();
              setInitiativeRollType(prev =>
                prev === 'normal' ? 'advantage' : prev === 'advantage' ? 'disadvantage' : 'normal'
              );
            }}
            className={`flex flex-col items-center ${bgClass} p-3 rounded-sm border ${borderClass} ${hoverBgClass} transition-colors cursor-pointer w-full h-full`}
            title={`Roll Initiative (${initiativeRollType}) - Right-click to cycle`}
          >
            <div className="flex items-center gap-1 mb-1">
              <Dice6 className={`w-5 h-5 ${iconClass}`} />
              {initiativeRollType !== 'normal' && (
                <span className="text-xs font-bold text-accent-green">
                  {initiativeRollType === 'advantage' ? 'A' : 'D'}
                </span>
              )}
            </div>
            <span className={`text-xs font-cinzel font-semibold ${textSecondaryClass} uppercase`}>Init</span>
            <div className={`text-2xl font-cinzel font-extrabold ${textBrownClass}`}>{formatModifier(character.initiative)}</div>
          </button>
        </div>

        {/* Speed */}
        <div className={`flex flex-col items-center ${bgClass} p-3 rounded-sm border ${borderClass}`}>
          <Footprints className={`w-5 h-5 ${iconClass} mb-1`} />
          <span className={`text-xs font-cinzel font-semibold ${textSecondaryClass} uppercase`}>Speed</span>
          <div className={`text-xl font-cinzel font-extrabold ${textPrimaryClass}`}>{getSpeed()} ft</div>
        </div>
      </div>

      {/* Middle Section - Hit Points */}
      <div className={`${bgClass} border ${borderClass} rounded-sm p-3 space-y-2`}>
        {/* HP Maximum */}
        <div className="flex items-center justify-between">
          <span className={`text-xs font-cinzel font-semibold ${textSecondaryClass} uppercase`}>Hit Point Maximum</span>
          <span className={`text-lg font-cinzel font-bold ${textPrimaryClass}`}>{character.maxHitPoints}</span>
        </div>

        {/* Current HP */}
        <div className={`flex items-center justify-between border-t ${borderClass} pt-2`}>
          <span className={`text-xs font-cinzel font-semibold ${textSecondaryClass} uppercase`}>Current Hit Points</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCurrentHpChange(-1)}
              className={`w-6 h-6 ${buttonRedBgClass} ${buttonRedHoverClass} ${hpTextClass} rounded flex items-center justify-center text-sm font-bold`}
              title="Reduce HP by 1"
            >
              −
            </button>
            <div className={`text-2xl font-cinzel font-extrabold ${hpGreenClass}`}>
              {character.hitPoints}
            </div>
            <button
              onClick={() => handleCurrentHpChange(1)}
              className={`w-6 h-6 ${buttonGreenBgClass} ${buttonGreenHoverClass} ${hpTextClass} rounded flex items-center justify-center text-sm font-bold`}
              title="Increase HP by 1"
            >
              +
            </button>
          </div>
        </div>

        {/* Temporary HP */}
        <div className={`flex items-center justify-between border-t ${borderClass} pt-2`}>
          <span className={`text-xs font-cinzel font-semibold ${textSecondaryClass} uppercase`}>Temporary Hit Points</span>
          <div className="flex items-center gap-2">
            {character.temporaryHitPoints && character.temporaryHitPoints > 0 ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleTempHpChange(-1)}
                  className={`w-4 h-4 ${buttonRedBgClass} ${buttonRedHoverClass} ${hpTextClass} rounded flex items-center justify-center text-xs`}
                  title="Reduce temp HP by 1"
                >
                  −
                </button>
                <span className={`text-lg font-cinzel font-bold ${textBrownClass}`}>+{character.temporaryHitPoints}</span>
                <button
                  onClick={() => handleTempHpChange(1)}
                  className={`w-4 h-4 ${buttonBrownBgClass} ${buttonBrownHoverClass} ${hpTextClass} rounded flex items-center justify-center text-xs`}
                  title="Increase temp HP by 1"
                >
                  +
                </button>
                <button
                  onClick={handleRemoveTempHp}
                  className={`text-xs ${buttonRedBgClass.replace('bg-', 'text-')} ${buttonRedHoverClass.replace('bg-', 'text-')}`}
                  title="Remove all temporary HP"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={tempHpInput}
                  onChange={(e) => setTempHpInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTempHp()}
                  placeholder="0"
                  className={`w-12 h-6 text-xs ${inputBgClass} ${inputTextClass} rounded border ${inputBorderClass} ${inputFocusBorderClass} focus:outline-none text-center`}
                  min="1"
                />
                <button
                  onClick={handleAddTempHp}
                  className={`w-6 h-6 flex items-center justify-center ${buttonBrownBgClass} ${buttonBrownHoverClass} rounded ${hpTextClass}`}
                  title="Add temporary HP"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row - Hit Dice & Death Saves */}
      <div className="grid grid-cols-2 gap-3">
        <HitDice
          character={character}
          onUpdateCharacter={onUpdateCharacter}
          layoutMode={layoutMode}
        />
        <DeathSaves
          character={character}
          onUpdateCharacter={onUpdateCharacter}
          layoutMode={layoutMode}
        />
      </div>
    </div>
  );
};
