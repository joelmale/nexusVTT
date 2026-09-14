import React, { useEffect } from 'react';
import type { DiceRoll } from '../utils/diceRoller';

interface RollResultOverlayProps {
  roll: DiceRoll | null;
  isVisible: boolean;
  onDismiss: () => void;
}

export const RollResultOverlay: React.FC<RollResultOverlayProps> = ({
  roll,
  isVisible,
  onDismiss
}) => {
  // Auto-dismiss after 4 seconds
  useEffect(() => {
    if (isVisible && roll) {
      const timer = setTimeout(onDismiss, 4000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, roll, onDismiss]);

  if (!isVisible || !roll) return null;

  // Determine animation classes based on critical status
  const criticalAnimationClass = roll.critical === 'success'
    ? 'animate-critical-success-pulse animate-critical-success-glow'
    : roll.critical === 'failure'
    ? 'animate-critical-failure-shake animate-critical-failure-glow'
    : '';

  return (
    <div
      className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
      onClick={onDismiss}
    >
      <div
        className={`bg-theme-secondary/95 border-2 border-theme-primary rounded-lg p-6 shadow-2xl backdrop-blur-sm animate-fade-in pointer-events-auto ${criticalAnimationClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Roll Label */}
        <h3 className="text-xl font-bold text-center mb-4 text-theme-primary">
          {roll.label}
        </h3>

        {/* Breakdown */}
        <div className="space-y-2 text-center">
          {/* Die Result */}
          <div className="flex items-center justify-center gap-2">
            <span className="text-theme-muted">{roll.notation.split(/[+-]/)[0]}:</span>
            <span className="text-3xl font-bold text-accent-blue">
              [{roll.diceResults.join(', ')}]
            </span>
          </div>

          {/* Modifier */}
          {roll.modifier !== 0 && (
            <div className="flex items-center justify-center gap-2">
              <span className="text-theme-muted">Modifier:</span>
              <span className="text-2xl font-semibold text-accent-green">
                {roll.modifier >= 0 ? '+' : ''}{roll.modifier}
              </span>
            </div>
          )}

          {/* Total */}
          <div className="pt-2 border-t border-theme-tertiary">
            <div className="flex items-center justify-center gap-2">
              <span className="text-theme-muted">Total:</span>
              <span
                className={`text-4xl font-bold ${
                  roll.critical === 'success'
                    ? 'text-accent-green-light'
                    : roll.critical === 'failure'
                    ? 'text-accent-red-light'
                    : 'text-accent-yellow'
                }`}
              >
                {roll.total}
              </span>
            </div>
          </div>

          {/* Critical indicator */}
          {roll.critical && (
            <div className={`text-sm font-bold ${
              roll.critical === 'success' ? 'text-green-500' : 'text-red-500'
            }`}>
              CRITICAL {roll.critical.toUpperCase()}!
            </div>
          )}
        </div>

        {/* Dismiss hint */}
        <div className="text-xs text-center mt-4 text-theme-muted opacity-60">
          Click anywhere to dismiss
        </div>
      </div>
    </div>
  );
};

export default RollResultOverlay;
