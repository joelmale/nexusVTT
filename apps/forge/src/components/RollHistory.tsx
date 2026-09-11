import React, { useState } from 'react';
import { History, X, Trash2 } from 'lucide-react';
import type { DiceRoll } from '../utils/diceRoller';
import type { LayoutMode } from '../components/CharacterSheet/AbilityScores';

interface RollHistoryTickerProps {
  rolls: DiceRoll[];
  layoutMode?: LayoutMode;
}

interface RollHistoryModalProps {
  rolls: DiceRoll[];
  onClear: () => void;
}

export const RollHistoryTicker: React.FC<RollHistoryTickerProps> = ({ rolls, layoutMode = 'modern-stacked' }) => {
  if (rolls.length === 0) return null;

  // Determine styling based on layout mode
  const getLayoutStyles = () => {
    switch (layoutMode) {
      case 'classic-dnd':
        return {
          container: 'bg-theme-secondary border-t-2 border-theme-secondary py-3 px-4',
          maxWidth: 'max-w-[1400px]'
        };
      case 'mobile':
        return {
          container: 'bg-theme-secondary/95 backdrop-blur-md border-t border-theme-secondary py-2 px-3',
          maxWidth: 'max-w-full'
        };
      case 'modern-stacked':
      default:
        return {
          container: 'bg-theme-secondary/95 backdrop-blur-md border-t border-theme-secondary py-3 px-4',
          maxWidth: 'max-w-4xl'
        };
    }
  };

  const styles = getLayoutStyles();

  return (
    <div className={`${styles.container} max-h-32 overflow-y-auto`}>
      <div className={`${styles.maxWidth} mx-auto flex items-center gap-4 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800`}>
        <span className="text-xs font-bold text-theme-muted whitespace-nowrap">
          Recent Rolls:
        </span>
        <div className="flex gap-4 flex-nowrap">
          {rolls.slice().reverse().map((roll) => (
            <div
              key={roll.id}
              className="flex items-center gap-2 text-sm whitespace-nowrap"
            >
              <span className="text-theme-tertiary">{roll.label}:</span>
              <span className="font-mono text-accent-yellow-light">{roll.notation}</span>
              <span className="text-theme-disabled">→</span>
              {/* Dice Results */}
              {roll.diceResults.length > 0 && (
                <span className="text-accent-blue">
                  [{roll.diceResults.join(', ')}]
                </span>
              )}
              {/* Show modifier breakdown if present */}
              {roll.modifier !== 0 && (
                <span className="text-accent-green">
                  {roll.modifier >= 0 ? '+' : ''}{roll.modifier}
                </span>
              )}
              {/* Equals sign before total */}
              <span className="text-theme-disabled">=</span>
              {/* Pools results for complex rolls */}
              {roll.pools?.length ? (
                <span className="text-xs text-theme-muted">
                  [{roll.pools[0].results.join(',')}]
                </span>
              ) : null}
              <span
                className={`font-bold ${
                  roll.critical === 'success'
                    ? 'text-accent-green-light'
                    : roll.critical === 'failure'
                    ? 'text-accent-red-light'
                    : 'text-white'
                }`}
              >
                {roll.total}
              </span>
              {roll.critical && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-theme-tertiary">
                  {roll.critical === 'success' ? 'CRIT!' : 'FAIL!'}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const RollHistoryModal: React.FC<RollHistoryModalProps> = ({
  rolls,
  onClear,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-[20px] right-4 md:right-[calc((100vw-95rem)/2+1rem)] p-3 bg-accent-red hover:bg-accent-red-light rounded-full shadow-lg transition-colors z-30"
        title="View Roll History"
      >
        <History className="w-6 h-6 text-white" />
      </button>
    );
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="bg-theme-secondary rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b border-theme-secondary p-4">
          <h2 className="text-xl font-bold text-red-500 flex items-center gap-2">
            <History className="w-5 h-5" />
            Roll History
          </h2>
          <div className="flex gap-2">
            {rolls.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('Clear all roll history?')) {
                    onClear();
                  }
                }}
                className="p-2 text-theme-muted hover:text-accent-red-light transition-colors"
                title="Clear History"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 text-theme-muted hover:text-white transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
          {rolls.length === 0 ? (
            <div className="text-center py-12 text-theme-disabled">
              <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-semibold">No rolls yet</p>
              <p className="text-sm">
                Click on ability scores or skills to roll dice
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {rolls
                .slice()
                .reverse()
                .map((roll) => (
                  <div
                    key={roll.id}
                    className={`p-4 rounded-lg border-l-4 ${
                      roll.critical === 'success'
                        ? 'bg-accent-green-darker/20 border-green-500'
                        : roll.critical === 'failure'
                        ? 'bg-red-900/20 border-red-500'
                        : 'bg-theme-tertiary/50 border-theme-primary'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">
                          {roll.label}
                        </span>
                        {roll.critical && (
                          <span
                            className={`text-xs px-2 py-1 rounded font-bold ${
                              roll.critical === 'success'
                                ? 'bg-accent-green text-white'
                                : 'bg-accent-red-light text-white'
                            }`}
                          >
                            {roll.critical === 'success'
                              ? 'CRITICAL SUCCESS!'
                              : 'CRITICAL FAILURE!'}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-theme-muted">
                        {formatTime(roll.timestamp)}
                      </span>
                    </div>

                     <div className="flex items-center gap-3 text-lg">
                       <span className="font-mono text-accent-yellow-light">
                         {roll.notation}
                       </span>
                       <span className="text-theme-disabled">→</span>
                       <div className="flex items-center gap-2">
                         {roll.pools?.length ? (
                           // Complex roll with pools
                           <div className="text-sm text-theme-muted">
                             {roll.pools.map((pool, poolIdx) => (
                               <span key={poolIdx}>
                                 [
                                 {pool.results.map((die, i) => {
                                   const isKept = roll.diceResults?.includes(die);
                                   return (
                                     <span key={i} className={isKept ? 'text-accent-yellow-light font-semibold' : 'text-theme-disabled line-through'}>
                                       {die}
                                       {i < pool.results.length - 1 && ', '}
                                     </span>
                                   );
                                 })}
                                 ]
                                 {poolIdx < roll.pools!.length - 1 && ' + '}
                               </span>
                             ))}
                           </div>
                         ) : (
                           // Simple roll
                           <span className="text-sm text-theme-muted">
                             [
                             {roll.diceResults.map((die, i) => (
                               <span key={i}>
                                 {die}
                                 {i < roll.diceResults.length - 1 && ', '}
                               </span>
                             ))}
                             ]
                           </span>
                         )}
                         {roll.modifier !== 0 && (
                           <span className="text-sm text-theme-muted">
                             {roll.modifier > 0 ? '+' : ''}
                             {roll.modifier}
                           </span>
                         )}
                         <span className="text-theme-disabled">=</span>
                         <span
                           className={`text-2xl font-bold ${
                             roll.critical === 'success'
                               ? 'text-accent-green-light'
                               : roll.critical === 'failure'
                               ? 'text-accent-red-light'
                               : 'text-white'
                           }`}
                         >
                           {roll.total}
                         </span>
                       </div>
                     </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RollHistoryModal;
