import React from 'react';

interface ProgressBarProps {
  value: number; // Current value
  max: number; // Max value
  label?: string; // Optional label displayed on the right/center
  variant?: 'bronze' | 'red' | 'blue' | 'parchment';
  showPercentage?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max,
  label,
  variant = 'bronze',
  showPercentage = false,
  className = '',
}) => {
  const safeMax = max <= 0 ? 100 : max;
  const percentage = Math.min(100, Math.max(0, (value / safeMax) * 100));

  const styles = {
    // Standard character level progress
    bronze: {
      bar: 'bg-gradient-to-r from-[#593d25] to-[#8c6b4a]',
      bg: 'bg-[#593d25]/15 border-[#8c6b4a]/30',
      text: 'text-[#362b21]/75',
    },
    // Health / Rage theme
    red: {
      bar: 'bg-gradient-to-r from-[#7f1d1d] to-[#ef4444]',
      bg: 'bg-[#7f1d1d]/15 border-[#ef4444]/30',
      text: 'text-[#ef4444]',
    },
    // Mana / Magic theme
    blue: {
      bar: 'bg-gradient-to-r from-[#1e3a8a] to-[#3b82f6]',
      bg: 'bg-[#1e3a8a]/15 border-[#3b82f6]/30',
      text: 'text-[#3b82f6]',
    },
    // Parchment theme
    parchment: {
      bar: 'bg-gradient-to-r from-[#8c6b4a] to-[#b89a7a]',
      bg: 'bg-black/10 border-[#8c6b4a]/25',
      text: 'text-[#362b21]/80',
    },
  };

  const currentTheme = styles[variant];

  return (
    <div className={`w-full font-['Oswald',sans-serif] ${className}`}>
      <div className="flex items-center justify-between text-[11px] font-semibold tracking-wider mb-1">
        {label && <span className={`${currentTheme.text} uppercase`}>{label}</span>}
        {showPercentage && (
          <span className="tabular-nums opacity-80">
            {Math.round(percentage)}%
          </span>
        )}
      </div>
      <div
        className={`relative h-2.5 rounded-sm border overflow-hidden ${currentTheme.bg}`}
      >
        {/* Distressed texture / gradient overlay inside progress bar */}
        <div
          className={`absolute top-0 bottom-0 left-0 transition-all duration-500 ease-out ${currentTheme.bar}`}
          style={{ width: `${percentage}%` }}
        />
        {/* Subtle noise overlay on the progress fill */}
        <div
          className="absolute inset-0 opacity-10 mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>
    </div>
  );
};
