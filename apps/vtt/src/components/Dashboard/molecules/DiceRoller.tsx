import React, { useState } from 'react';
import { DiceRollResult } from '../types';
import { DieButton } from '../atoms/DieButton';
import { GothicHeader } from '../atoms/Typography';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';

interface DiceRollerProps {
  className?: string;
}

export const DiceRoller: React.FC<DiceRollerProps> = ({ className = '' }) => {
  const [rollHistory, setRollHistory] = useState<DiceRollResult[]>([]);

  const handleRoll = (dieType: string, result: number) => {
    const newRoll: DiceRollResult = {
      id: Math.random().toString(36).substring(2, 9),
      dieType,
      rolls: [result],
      modifier: 0,
      total: result,
      timestamp: new Date().toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    };

    setRollHistory((prev) => [newRoll, ...prev]);
  };

  const clearHistory = () => {
    setRollHistory([]);
  };

  return (
    <div
      className={`
        flex flex-col md:flex-row gap-4 p-4 rounded-sm
        bg-[#252a31] border border-[#8c6b4a]/40 shadow-2xl
        w-full max-w-xl mr-auto
        ${className}
      `}
    >
      {/* Left side: Interactive Dice Panel */}
      <div className="flex-1">
        <GothicHeader level={3} variant="medieval" className="mb-2">
          Interactive Dice Roller
        </GothicHeader>
        <p className="text-[11px] text-[#cbd5e1]/70 mb-3 font-serif italic">
          Click any die below to initiate a rolling sequence and log the final result.
        </p>

        <div className="grid grid-cols-4 gap-2 max-w-[12.5rem]">
          <DieButton dieType="d4" onRoll={handleRoll} />
          <DieButton dieType="d6" onRoll={handleRoll} />
          <DieButton dieType="d8" onRoll={handleRoll} />
          <DieButton dieType="d10" onRoll={handleRoll} />
          <DieButton dieType="d12" onRoll={handleRoll} />
          <DieButton dieType="d20" onRoll={handleRoll} />
          <DieButton dieType="d100" onRoll={handleRoll} />
        </div>
      </div>

      {/* Right side: Roll Log / Ledger */}
      <div className="w-full md:w-56 flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-[#8c6b4a]/30 pb-2 mb-3">
          <span className="font-['Oswald',sans-serif] text-xs font-bold tracking-wider text-[#cbd5e1] uppercase">
            Roll Ledger
          </span>
          {rollHistory.length > 0 && (
            <button
              onClick={clearHistory}
              type="button"
              className="text-[#cbd5e1]/60 hover:text-red-400 transition-colors text-xs flex items-center gap-1 focus:outline-none"
            >
              <Trash2 size={12} /> Clear
            </button>
          )}
        </div>

        {/* Scrollable history logs */}
        <div
          className="
            flex-1 min-h-[9rem] max-h-36 overflow-y-auto pr-1
            flex flex-col gap-2 font-mono text-xs
          "
        >
          {rollHistory.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-[#cbd5e1]/30 font-serif italic text-center p-4">
              Ledger is currently empty. Roll a die!
            </div>
          ) : (
            rollHistory.map((roll) => (
              <div
                key={roll.id}
                className="
                  flex items-center justify-between p-2 rounded-sm
                  bg-[#f1e6d3] text-[#362b21] border border-[#8c6b4a]/30
                  shadow-[0_1px_3px_rgba(0,0,0,0.15)] animate-[slideIn_0.2s_ease-out]
                "
              >
                <div className="flex items-center gap-1.5 font-sans">
                  <span className="font-bold text-amber-700 uppercase tracking-wider text-[10px] bg-amber-700/10 px-1 rounded-sm">
                    {roll.dieType}
                  </span>
                  <span className="text-[11px] text-[#362b21]/70">
                    Rolled:
                  </span>
                  <span className="font-['Oswald',sans-serif] font-bold text-sm">
                    {roll.total}
                  </span>
                </div>
                <span className="text-[9px] text-[#362b21]/50 tabular-nums">
                  {roll.timestamp}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};
