import React, { useEffect, useRef, useState, useCallback } from 'react';
import DiceBox, { DiceBoxConfig } from '@3d-dice/dice-box';
import './DiceRollerModal.css';
import { diceSounds } from '../utils/diceSounds';
import { rollDice as rollDiceUtil } from '../services/diceService';
import { log } from '../utils/logger';

interface DiceRollResult {
  qty: number;
  sides: number;
  value: number;
  groupId: number;
  rollId: string;
  theme: string;
}

interface DiceRollerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRollComplete?: (results: DiceRollResult[]) => void;
}

interface DiceConfig {
  type: string;
  label: string;
  icon: string;
  color?: string;
}

const getDiceIcon = (type: string, style: 'BW' | 'Color'): string => {
  return `/assets/dice-icons/${type}_${style}_nobg.png`;
};

const DICE_TYPES: DiceConfig[] = [
  { type: 'd4', label: 'D4', icon: '', color: '#FF6B6B' },
  { type: 'd6', label: 'D6', icon: '', color: '#4ECDC4' },
  { type: 'd8', label: 'D8', icon: '', color: '#45B7D1' },
  { type: 'd10', label: 'D10', icon: '', color: '#96CEB4' },
  { type: 'd12', label: 'D12', icon: '', color: '#FFEAA7' },
  { type: 'd20', label: 'D20', icon: '', color: '#DDA0DD' },
  { type: 'd100', label: 'D100', icon: '', color: '#98D8C8' },
];

export const DiceRollerModal: React.FC<DiceRollerModalProps> = ({
  isOpen,
  onClose,
  onRollComplete,
}) => {
  const diceBoxRef = useRef<HTMLDivElement>(null);
  const diceBoxInstanceRef = useRef<DiceBox | null>(null);
  const [selectedDice, setSelectedDice] = useState<Map<string, number>>(new Map());
  const [isRolling, setIsRolling] = useState(false);
  const [lastResult, setLastResult] = useState<DiceRollResult | null>(null);
  const [diceBoxReady, setDiceBoxReady] = useState(false);
  const [modifier, setModifier] = useState<number>(0);
  const [diceStyle, setDiceStyle] = useState<'BW' | 'Color'>('BW');


  // Initialize dice box when modal opens
  useEffect(() => {
    if (isOpen && !diceBoxInstanceRef.current) {
      const initDiceBox = async () => {
        try {
          // Simplified config matching DiceBox3D
          const config: DiceBoxConfig = {
            container: '#dice-box-container',
            assetPath: '/assets/dice-box/',
            offscreen: false,
            gravity: 2,
            friction: 0.9,
            restitution: 0.3,
            linearDamping: 0.6,
            angularDamping: 0.6,
            spinForce: 3,
            throwForce: 4,
            startingHeight: 6,
            settleTimeout: 2000,
            enableShadows: true,
            scale: 6
          };

          const box = new DiceBox(config);

          await box.init();

          // Ensure canvas is visible and sized properly
          setTimeout(() => {
            const container = document.getElementById('dice-box-container');
            if (container) {
              const canvas = container.querySelector('canvas');
              if (canvas) {
                // Canvas is ready, no additional setup needed
              } else {
                log.warn('DiceRollerModal canvas not found');
              }
            }
          }, 100);

          // Set up roll complete callback
          box.onRollComplete = (results: DiceRollResult[]) => {
            setIsRolling(false);

            // Calculate total from all dice
            const total = results.reduce((sum, die) => sum + die.value, 0);

            // Store aggregated result
            setLastResult({
              qty: results.length,
              sides: 0, // Mixed dice types
              value: total,
              groupId: results[0]?.groupId || 0,
              rollId: results[0]?.rollId || '',
              theme: results[0]?.theme || 'default',
            });

            onRollComplete?.(results);
          };

          diceBoxInstanceRef.current = box;
          setDiceBoxReady(true);
        } catch (error) {
          log.error('Failed to initialize dice box', { error });
          setDiceBoxReady(false);
        }
      };

      initDiceBox();
    }

    // Cleanup
    return () => {
      if (!isOpen && diceBoxInstanceRef.current) {
        diceBoxInstanceRef.current.clear();
        diceBoxInstanceRef.current = null;
        setDiceBoxReady(false);
      }
    };
  }, [isOpen, onRollComplete]);

  const updateDiceCount = useCallback((diceType: string, delta: number) => {
    setSelectedDice((prev) => {
      const newMap = new Map(prev);
      const currentCount = newMap.get(diceType) || 0;
      const newCount = Math.max(0, Math.min(10, currentCount + delta));

      if (newCount === 0) {
        newMap.delete(diceType);
      } else {
        newMap.set(diceType, newCount);
      }

      return newMap;
    });
  }, []);

  const buildNotation = useCallback(() => {
    const parts: string[] = [];

    selectedDice.forEach((count, type) => {
      if (count > 0) {
        parts.push(`${count}${type}`);
      }
    });

    if (parts.length === 0) return '';

    let notation = parts.join('+');
    if (modifier !== 0) {
      notation += modifier > 0 ? `+${modifier}` : `${modifier}`;
    }

    return notation;
  }, [selectedDice, modifier]);

  const rollDice = useCallback(async () => {
    const notation = buildNotation();

    if (!notation || !diceBoxInstanceRef.current || !diceBoxReady) {
      return;
    }

    setIsRolling(true);
    setLastResult(null);

    try {
      await diceBoxInstanceRef.current.clear();

      // Build array of individual dice notations and pre-calculate results
      const rollNotations: string[] = [];
      const allValues: number[] = [];
      selectedDice.forEach((count, type) => {
        if (count > 0) {
          const diceType = type as 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';
          const sides = parseInt(diceType.substring(1)); // Remove 'd' prefix
          const values = rollDiceUtil(count, sides);
          rollNotations.push(`${count}${type}`);
          allValues.push(...values);
        }
      });

      // Calculate total number of dice for sound
      const totalDice = Array.from(selectedDice.values()).reduce((sum, count) => sum + count, 0);

      // Play dice sound when roll starts
      diceSounds.playRollSound(totalDice);

      // Roll all dice with fixed values
      await diceBoxInstanceRef.current.roll(rollNotations, { values: allValues });
    } catch (error) {
      log.error('Dice roll failed', { error, notation });
      setIsRolling(false);
    }
  }, [buildNotation, diceBoxReady, selectedDice]);

  const clearSelection = useCallback(() => {
    setSelectedDice(new Map());
    setModifier(0);
    setLastResult(null);
    diceBoxInstanceRef.current?.clear();
  }, []);

  const quickRoll = useCallback((diceType: string) => {
    setSelectedDice(new Map([[diceType, 1]]));
    setModifier(0);
    setTimeout(() => rollDice(), 100);
  }, [rollDice]);

  if (!isOpen) return null;

  return (
    <div className="dice-modal-overlay" onClick={onClose}>
      <div className="dice-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dice-modal-header">
          <h2>Dice Roller</h2>
          <div className="dice-style-toggle">
            <label className="toggle-option">
              <input
                type="radio"
                name="diceStyle"
                value="BW"
                checked={diceStyle === 'BW'}
                onChange={() => setDiceStyle('BW')}
              />
              <span>B&W</span>
            </label>
            <label className="toggle-option">
              <input
                type="radio"
                name="diceStyle"
                value="Color"
                checked={diceStyle === 'Color'}
                onChange={() => setDiceStyle('Color')}
              />
              <span>Color</span>
            </label>
          </div>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="dice-selector">
          {DICE_TYPES.map((dice) => (
            <div key={dice.type} className="dice-control">
              <button
                className={`dice-button ${selectedDice.has(dice.type) ? 'selected' : ''}`}
                style={{ '--dice-color': dice.color } as React.CSSProperties}
                onClick={() => quickRoll(dice.type)}
                title={`Quick roll ${dice.label}`}
              >
                <img src={getDiceIcon(dice.type, diceStyle)} alt={dice.label} className="dice-icon" />
                <span className="dice-label">{dice.label}</span>
              </button>
              <div className="dice-counter">
                <button
                  className="counter-btn"
                  onClick={() => updateDiceCount(dice.type, -1)}
                >
                  -
                </button>
                <span className="counter-value">
                  {selectedDice.get(dice.type) || 0}
                </span>
                <button
                  className="counter-btn"
                  onClick={() => updateDiceCount(dice.type, 1)}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="modifier-section">
          <label>Modifier:</label>
          <input
            type="number"
            value={modifier}
            onChange={(e) => setModifier(parseInt(e.target.value) || 0)}
            min="-20"
            max="20"
            className="modifier-input"
          />
        </div>

        <div className="dice-notation">
          {buildNotation() || 'Select dice to roll'}
        </div>

        <div id="dice-box-container" ref={diceBoxRef} className="dice-box-container">
          {!diceBoxReady && <div className="loading">Initializing dice box...</div>}
        </div>

        {lastResult && (
          <div className="result-display">
            <span className="result-label">Result:</span>
            <span className="result-value">
              {lastResult.value + modifier}
            </span>
            <span className="result-breakdown">
              ({buildNotation()})
              {modifier !== 0 && (
                <span className="ml-1">
                  = {lastResult.value} {modifier > 0 ? '+' : ''}{modifier}
                </span>
              )}
            </span>
          </div>
        )}

        <div className="dice-actions">
          <button
            className="roll-button"
            onClick={rollDice}
            disabled={!buildNotation() || isRolling || !diceBoxReady}
          >
            {isRolling ? 'Rolling...' : 'Roll Dice'}
          </button>
          <button
            className="clear-button"
            onClick={clearSelection}
            disabled={isRolling}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
};
