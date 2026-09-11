import React, { useState } from 'react';

interface DieButtonProps {
  dieType: 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';
  onRoll: (dieType: string, result: number) => void;
  className?: string;
}

export const DieButton: React.FC<DieButtonProps> = ({
  dieType,
  onRoll,
  className = '',
}) => {
  const [isRolling, setIsRolling] = useState(false);

  const rollDie = () => {
    if (isRolling) return;
    setIsRolling(true);

    const sides = {
      d4: 4,
      d6: 6,
      d8: 8,
      d10: 10,
      d12: 12,
      d20: 20,
      d100: 100,
    };

    const maxVal = sides[dieType];

    setTimeout(() => {
      const result = Math.floor(Math.random() * maxVal) + 1;
      onRoll(dieType, result);
      setIsRolling(false);
    }, 800);
  };

  const renderDieSVG = () => {
    switch (dieType) {
      case 'd4':
        return (
          <svg viewBox="0 0 100 100" className="w-8 h-8">
            <polygon points="50,15 15,80 85,80" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
            <line x1="50" y1="15" x2="50" y2="80" stroke="currentColor" strokeWidth="1.5" strokeDasharray="1.5 2" />
            <line x1="15" y1="80" x2="50" y2="80" stroke="currentColor" strokeWidth="1.5" strokeDasharray="1.5 2" />
            <line x1="85" y1="80" x2="50" y2="80" stroke="currentColor" strokeWidth="1.5" strokeDasharray="1.5 2" />
            <text x="50" y="60" textAnchor="middle" dominantBaseline="middle" className="font-['Oswald'] font-bold text-xs" fill="currentColor">D4</text>
          </svg>
        );
      case 'd6':
        return (
          <svg viewBox="0 0 100 100" className="w-8 h-8">
            <rect x="20" y="20" width="60" height="60" rx="6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
            <circle cx="35" cy="35" r="4.5" fill="currentColor" />
            <circle cx="65" cy="65" r="4.5" fill="currentColor" />
            <circle cx="35" cy="65" r="4.5" fill="currentColor" />
            <circle cx="65" cy="35" r="4.5" fill="currentColor" />
            <circle cx="50" cy="50" r="4.5" fill="currentColor" />
            <text x="50" y="52" textAnchor="middle" dominantBaseline="middle" className="font-['Oswald'] font-black text-[10px] bg-slate-900 px-1 rounded-sm text-amber-500" fill="currentColor">D6</text>
          </svg>
        );
      case 'd8':
        return (
          <svg viewBox="0 0 100 100" className="w-8 h-8">
            <polygon points="50,10 85,50 50,90 15,50" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
            <line x1="15" y1="50" x2="85" y2="50" stroke="currentColor" strokeWidth="1.5" />
            <line x1="50" y1="10" x2="50" y2="90" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
            <text x="50" y="45" textAnchor="middle" dominantBaseline="middle" className="font-['Oswald'] font-bold text-xs" fill="currentColor">D8</text>
          </svg>
        );
      case 'd10':
        return (
          <svg viewBox="0 0 100 100" className="w-8 h-8">
            <polygon points="50,10 85,42 50,90 15,42" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
            <line x1="50" y1="10" x2="50" y2="90" stroke="currentColor" strokeWidth="1.5" />
            <line x1="15" y1="42" x2="50" y2="42" stroke="currentColor" strokeWidth="1.5" />
            <line x1="85" y1="42" x2="50" y2="42" stroke="currentColor" strokeWidth="1.5" />
            <text x="50" y="32" textAnchor="middle" dominantBaseline="middle" className="font-['Oswald'] font-bold text-xs" fill="currentColor">D10</text>
          </svg>
        );
      case 'd12':
        return (
          <svg viewBox="0 0 100 100" className="w-8 h-8">
            <polygon points="50,10 80,32 70,78 30,78 20,32" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
            <polygon points="50,32 68,46 62,68 38,68 32,46" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="1.5 1.5" />
            <line x1="50" y1="10" x2="50" y2="32" stroke="currentColor" strokeWidth="1.2" />
            <line x1="80" y1="32" x2="68" y2="46" stroke="currentColor" strokeWidth="1.2" />
            <line x1="70" y1="78" x2="62" y2="68" stroke="currentColor" strokeWidth="1.2" />
            <line x1="30" y1="78" x2="38" y2="68" stroke="currentColor" strokeWidth="1.2" />
            <line x1="20" y1="32" x2="32" y2="46" stroke="currentColor" strokeWidth="1.2" />
            <text x="50" y="51" textAnchor="middle" dominantBaseline="middle" className="font-['Oswald'] font-bold text-xs" fill="currentColor">D12</text>
          </svg>
        );
      case 'd20':
        return (
          <svg viewBox="0 0 100 100" className="w-8 h-8">
            <polygon points="50,8 90,32 90,72 50,92 10,72 10,32" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
            <polygon points="50,30 80,48 50,78 20,48" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <line x1="50" y1="8" x2="50" y2="30" stroke="currentColor" strokeWidth="1.5" />
            <line x1="90" y1="32" x2="80" y2="48" stroke="currentColor" strokeWidth="1.5" />
            <line x1="90" y1="72" x2="50" y2="78" stroke="currentColor" strokeWidth="1.5" />
            <line x1="10" y1="72" x2="50" y2="78" stroke="currentColor" strokeWidth="1.5" />
            <line x1="10" y1="32" x2="20" y2="48" stroke="currentColor" strokeWidth="1.5" />
            <line x1="50" y1="92" x2="50" y2="78" stroke="currentColor" strokeWidth="1.5" />
            <text x="50" y="52" textAnchor="middle" dominantBaseline="middle" className="font-['Oswald'] font-bold text-xs text-amber-500" fill="currentColor">20</text>
          </svg>
        );
      case 'd100':
        return (
          <svg viewBox="0 0 100 100" className="w-8 h-8">
            <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="50" cy="50" r="32" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
            <text x="50" y="53" textAnchor="middle" dominantBaseline="middle" className="font-['Oswald'] font-bold text-xs" fill="currentColor">d100</text>
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <button
      onClick={rollDie}
      disabled={isRolling}
      type="button"
      className={`
        relative flex flex-col items-center justify-center p-2
        rounded-sm border border-[#8c6b4a]/40 bg-[#1c1e22] text-[#f1e6d3]
        hover:bg-[#8c6b4a]/25 hover:border-[#d97706] hover:shadow-vtt-amber-glow hover:text-amber-400
        transition-all duration-200 cursor-pointer select-none
        disabled:opacity-80
        ${isRolling ? 'animate-[bounce_0.2s_infinite] rotate-12 scale-95 border-amber-500 text-amber-400 shadow-vtt-amber-glow' : ''}
        ${className}
      `}
      title={`Roll a ${dieType.toUpperCase()}`}
    >
      {renderDieSVG()}
      <span className="font-['Oswald'] text-[8px] font-bold uppercase tracking-wider mt-0.5 opacity-60">
        {dieType.toUpperCase()}
      </span>
    </button>
  );
};
export default DieButton;
