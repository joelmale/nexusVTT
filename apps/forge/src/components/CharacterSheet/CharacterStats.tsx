import React, { useState } from 'react';
import { Shield, Zap, Dice6, BookOpen, UserIcon, Footprints } from 'lucide-react';
import { Character } from '../../types/dnd';
import { createInitiativeRoll, createAdvantageRoll, createDisadvantageRoll, DiceRoll } from '../../services/diceService';
import { formatModifier } from '../../utils/formatters';
import type { LayoutMode } from './AbilityScores';

interface CharacterStatsProps {
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

export const CharacterStats: React.FC<CharacterStatsProps> = ({
  character,
  setRollResult,
  onDiceRoll,
  onUpdateCharacter,
  layoutMode = 'modern',
}) => {
  const [initiativeRollType, setInitiativeRollType] = useState<RollType>('normal');
  const [tempHpInput, setTempHpInput] = useState('');
  const passivePerception = (character.skills.Perception.value + 10);

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
  };

  // Calculate speed (most characters have 30 ft unless modified)
  const getSpeed = () => {
    // TODO: This should be calculated based on species/class features
    // For now, return default speed
    return 30;
  };

  const handleAddTempHp = () => {
    const amount = parseInt(tempHpInput);
    if (isNaN(amount) || amount <= 0 || !onUpdateCharacter) return;

    const currentTempHp = character.temporaryHitPoints || 0;
    const newTempHp = Math.max(0, currentTempHp + amount);

    onUpdateCharacter({
      ...character,
      temporaryHitPoints: newTempHp
    });
    setTempHpInput('');
  };

  const handleRemoveTempHp = () => {
    if (!onUpdateCharacter) return;

    onUpdateCharacter({
      ...character,
      temporaryHitPoints: 0
    });
  };

  const handleCurrentHpChange = (delta: number) => {
    if (!onUpdateCharacter) return;

    const newHp = Math.max(0, Math.min(character.maxHitPoints, character.hitPoints + delta));
    onUpdateCharacter({
      ...character,
      hitPoints: newHp
    });
  };

  const handleTempHpChange = (delta: number) => {
    if (!onUpdateCharacter) return;

    const currentTempHp = character.temporaryHitPoints || 0;
    const newTempHp = Math.max(0, currentTempHp + delta);
    onUpdateCharacter({
      ...character,
      temporaryHitPoints: newTempHp
    });
  };

  // Classic layout: 3x2 grid, more compact and boxed
  if (layoutMode === 'classic') {
    return (
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center bg-theme-tertiary/50 p-3 rounded border border-theme-primary">
          <Shield className="w-5 h-5 text-red-500 mb-1" />
          <span className="text-xs font-semibold text-theme-muted uppercase">AC</span>
          <div className="text-3xl font-extrabold text-theme-primary">{character.armorClass}</div>
        </div>
        <div className="flex flex-col items-center bg-theme-tertiary/50 p-3 rounded border border-theme-primary">
          <Zap className="w-5 h-5 text-red-500 mb-1" />
          <span className="text-xs font-semibold text-theme-muted uppercase">HP</span>
          <div className="text-center">
            <div className="flex items-center gap-1 justify-center">
              {onUpdateCharacter && (
                <button
                  onClick={() => handleCurrentHpChange(-1)}
                  className="w-5 h-5 bg-red-600 hover:bg-red-700 text-white rounded flex items-center justify-center text-xs font-bold"
                  title="Reduce HP by 1"
                >
                  −
                </button>
              )}
              <div className="text-xl font-extrabold text-accent-green-light">
                {character.hitPoints}
                <span className="text-theme-muted text-sm">/{character.maxHitPoints}</span>
              </div>
              {onUpdateCharacter && (
                <button
                  onClick={() => handleCurrentHpChange(1)}
                  className="w-5 h-5 bg-green-600 hover:bg-green-700 text-white rounded flex items-center justify-center text-xs font-bold"
                  title="Increase HP by 1"
                >
                  +
                </button>
              )}
            </div>
            {character.temporaryHitPoints && character.temporaryHitPoints > 0 && (
              <div className="text-xs font-bold text-accent-blue-light flex items-center justify-center gap-1">
                {onUpdateCharacter && (
                  <button
                    onClick={() => handleTempHpChange(-1)}
                    className="w-3 h-3 bg-red-600 hover:bg-red-700 text-white rounded flex items-center justify-center text-xs"
                    title="Reduce temp HP by 1"
                  >
                    −
                  </button>
                )}
                +{character.temporaryHitPoints} temp
                {onUpdateCharacter && (
                  <>
                    <button
                      onClick={() => handleTempHpChange(1)}
                      className="w-3 h-3 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center justify-center text-xs"
                      title="Increase temp HP by 1"
                    >
                      +
                    </button>
                    <button
                      onClick={handleRemoveTempHp}
                      className="text-xs text-accent-red-light hover:text-red-300 ml-1"
                      title="Remove all temporary HP"
                    >
                      ×
                    </button>
                  </>
                )}
              </div>
            )}
            {onUpdateCharacter && (
              <div className="mt-1 flex items-center gap-1 justify-center">
                <input
                  type="number"
                  value={tempHpInput}
                  onChange={(e) => setTempHpInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTempHp()}
                  placeholder="+"
                  className="w-8 h-5 text-xs bg-theme-tertiary text-theme-primary rounded border border-theme-primary focus:border-blue-500 focus:outline-none text-center"
                  min="1"
                />
                <button
                  onClick={handleAddTempHp}
                  className="text-xs text-accent-blue-light hover:text-blue-300"
                  title="Add temporary HP"
                >
                  +
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => handleInitiativeRoll()}
            onContextMenu={(e) => {
              e.preventDefault();
              setInitiativeRollType(prev => prev === 'normal' ? 'advantage' : prev === 'advantage' ? 'disadvantage' : 'normal');
            }}
            className="flex flex-col items-center bg-theme-tertiary/50 p-3 rounded border border-theme-primary hover:bg-accent-red-dark/50 transition-colors cursor-pointer w-full h-full"
            title={`Roll Initiative (${initiativeRollType}) - Right-click to cycle`}
          >
            <div className="flex items-center gap-1 mb-1">
              <Dice6 className="w-5 h-5 text-red-500" />
              {initiativeRollType !== 'normal' && (
                <span className="text-xs font-bold text-accent-green-light">
                  {initiativeRollType === 'advantage' ? 'A' : 'D'}
                </span>
              )}
            </div>
            <span className="text-xs font-semibold text-theme-muted uppercase">Init</span>
            <div className="text-2xl font-extrabold text-accent-yellow-light">{formatModifier(character.initiative)}</div>
          </button>
        </div>
        <div className="flex flex-col items-center bg-theme-tertiary/50 p-3 rounded border border-theme-primary">
          <Footprints className="w-5 h-5 text-red-500 mb-1" />
          <span className="text-xs font-semibold text-theme-muted uppercase">Speed</span>
          <div className="text-xl font-extrabold text-accent-blue-light">{getSpeed()} ft</div>
        </div>
        <div className="flex flex-col items-center bg-theme-tertiary/50 p-3 rounded border border-theme-primary">
          <BookOpen className="w-5 h-5 text-red-500 mb-1" />
          <span className="text-xs font-semibold text-theme-muted uppercase">Prof</span>
          <div className="text-xl font-extrabold text-accent-yellow-light">+{character.proficiencyBonus}</div>
        </div>
        <div className="flex flex-col items-center bg-theme-tertiary/50 p-3 rounded border border-theme-primary">
          <UserIcon className="w-5 h-5 text-red-500 mb-1" />
          <span className="text-xs font-semibold text-theme-muted uppercase">Pass Perc</span>
          <div className="text-xl font-extrabold text-theme-primary">{passivePerception}</div>
        </div>
      </div>
    );
  }

  // Modern layout: Horizontal 6-column grid
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 bg-theme-secondary/70 p-4 rounded-xl shadow-lg border border-red-900">
      <div className="col-span-1 flex flex-col items-center"><Shield className="w-6 h-6 text-red-500 mb-1" /><span className="text-sm font-semibold text-theme-muted">AC</span><div className="text-4xl font-extrabold text-theme-primary">{character.armorClass}</div></div>
      <div className="col-span-1 flex flex-col items-center">
        <Zap className="w-6 h-6 text-red-500 mb-1" />
        <span className="text-sm font-semibold text-theme-muted">HP</span>
        <div className="text-center">
          <div className="text-2xl font-extrabold text-accent-green-light">
            {character.hitPoints}
            <span className="text-theme-muted text-lg">/{character.maxHitPoints}</span>
          </div>
          {character.temporaryHitPoints && character.temporaryHitPoints > 0 && (
            <div className="text-sm font-bold text-accent-blue-light flex items-center justify-center gap-1">
              +{character.temporaryHitPoints} temp
              {onUpdateCharacter && (
                <button
                  onClick={handleRemoveTempHp}
                  className="text-xs text-accent-red-light hover:text-red-300 ml-1"
                  title="Remove temporary HP"
                >
                  ×
                </button>
              )}
            </div>
          )}
          {onUpdateCharacter && (
            <div className="mt-1 flex items-center gap-1">
              <input
                type="number"
                value={tempHpInput}
                onChange={(e) => setTempHpInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTempHp()}
                placeholder="+"
                className="w-8 h-5 text-xs bg-theme-tertiary text-theme-primary rounded border border-theme-primary focus:border-blue-500 focus:outline-none text-center"
                min="1"
              />
              <button
                onClick={handleAddTempHp}
                className="text-xs text-accent-blue-light hover:text-blue-300"
                title="Add temporary HP"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="col-span-1 relative">
        <button
          onClick={() => handleInitiativeRoll()}
          onContextMenu={(e) => {
            e.preventDefault();
            // Cycle through roll types
            setInitiativeRollType(prev => prev === 'normal' ? 'advantage' : prev === 'advantage' ? 'disadvantage' : 'normal');
          }}
          className="flex flex-col items-center bg-theme-tertiary/50 p-2 rounded-lg hover:bg-accent-red-dark/70 transition-colors cursor-pointer w-full"
          title={`Roll Initiative (${initiativeRollType}) - Right-click to cycle`}
        >
          <div className="flex items-center gap-1 mb-1">
            <Dice6 className="w-5 h-5 text-red-500" />
            {initiativeRollType !== 'normal' && (
              <span className="text-xs font-bold text-accent-green-light">
                {initiativeRollType === 'advantage' ? 'A' : 'D'}
              </span>
            )}
          </div>
          <span className="text-sm font-semibold text-theme-muted">Init</span>
          <div className="text-2xl font-extrabold text-accent-yellow-light">{formatModifier(character.initiative)}</div>
        </button>
      </div>
      <div className="col-span-1 flex flex-col items-center"><Footprints className="w-6 h-6 text-red-500 mb-1" /><span className="text-sm font-semibold text-theme-muted">Speed</span><div className="text-2xl font-extrabold text-accent-blue-light">{getSpeed()} ft</div></div>
      <div className="col-span-1 flex flex-col items-center"><BookOpen className="w-6 h-6 text-red-500 mb-1" /><span className="text-sm font-semibold text-theme-muted">Prof</span><div className="text-2xl font-extrabold text-accent-yellow-light">+{character.proficiencyBonus}</div></div>
      <div className="col-span-1 flex flex-col items-center"><UserIcon className="w-6 h-6 text-red-500 mb-1" /><span className="text-sm font-semibold text-theme-muted">Pass Perc</span><div className="text-2xl font-extrabold text-theme-primary">{passivePerception}</div></div>
    </div>
  );
};