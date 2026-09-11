/**
 * Dice Roll Message Component
 *
 * Displays dice roll results in chat with visual breakdown
 */

import React from 'react';
import type { DiceRollData } from '@/types/chat';

interface DiceRollMessageProps {
  userName: string;
  diceData: DiceRollData;
  onReroll?: () => void;
}

/**
 * Individual die display
 */
const DieResult: React.FC<{
  value: number;
  isCrit?: boolean;
  isCritFail?: boolean;
}> = ({ value, isCrit, isCritFail }) => {
  const className = `die-result ${isCrit ? 'crit-success' : ''} ${isCritFail ? 'crit-failure' : ''}`;

  return (
    <span className={className} title={`Rolled ${value}`}>
      {value}
    </span>
  );
};

/**
 * Dice roll message display
 */
export const DiceRollMessage: React.FC<DiceRollMessageProps> = ({
  userName,
  diceData,
  onReroll,
}) => {
  const { expression, results, total, modifier, isCrit, isCritFail } = diceData;
  const modifierText =
    modifier !== 0 ? ` ${modifier > 0 ? '+' : ''}${modifier}` : '';
  const resultsText = results.join(' + ');

  return (
    <div className="dice-roll-message">
      {/* Header with expression and reroll button */}
      <div className="dice-roll-header">
        <span className="dice-expression">
          🎲 {userName} rolled <strong>{expression}</strong>
        </span>
        <div className="dice-roll-actions">
          <span
            className={`dice-total-badge ${isCrit ? 'crit-success' : ''} ${isCritFail ? 'crit-failure' : ''}`}
            title="Roll total"
          >
            {total}
          </span>
          {onReroll && (
            <button
              className="dice-reroll-btn"
              onClick={onReroll}
              title="Roll again"
              type="button"
            >
              ↻
            </button>
          )}
        </div>
      </div>

      {/* Dice results breakdown */}
      <div className="dice-results">
        <div className="dice-pool">
          {results.map((value, index) => (
            <DieResult
              key={index}
              value={value}
              isCrit={isCrit && results.length === 1}
              isCritFail={isCritFail && results.length === 1}
            />
          ))}
        </div>

        {modifier !== 0 && (
          <span className="dice-modifier">
            {modifier > 0 ? '+' : ''}
            {modifier}
          </span>
        )}
      </div>

      <div className="dice-equation">
        <span className="dice-equation-label">Results</span>
        <span className="dice-equation-values">{resultsText}</span>
        {modifier !== 0 && (
          <span className="dice-equation-modifier">{modifierText}</span>
        )}
        <span className="dice-equation-equals">=</span>
        <span
          className={`dice-equation-total ${isCrit ? 'crit-success' : ''} ${isCritFail ? 'crit-failure' : ''}`}
        >
          {total}
        </span>
      </div>

      {/* Crit indicators */}
      {isCrit && <div className="dice-crit-indicator">🌟 Critical Success!</div>}
      {isCritFail && (
        <div className="dice-crit-fail-indicator">💥 Critical Failure!</div>
      )}
    </div>
  );
};
