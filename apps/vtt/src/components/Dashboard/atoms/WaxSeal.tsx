import React from 'react';
import type { TableStatus } from '../types';

interface WaxSealProps {
  status: TableStatus;
  className?: string;
}

const SEALS: Record<
  Exclude<TableStatus, 'never'>,
  { label: string; wax: string; rim: string; ink: string }
> = {
  open: {
    label: 'Table open',
    wax: '#d97706',
    rim: '#92400e',
    ink: 'text-amber-900',
  },
  resting: {
    label: 'Resting',
    wax: '#8a9099',
    rim: '#5b616a',
    ink: 'text-slate-700',
  },
};

/**
 * Wax seal showing whether a table is running. The state is always spelled out
 * in text next to the seal so it never relies on colour alone. A table that has
 * never been played gets no seal at all.
 */
export const WaxSeal: React.FC<WaxSealProps> = ({ status, className = '' }) => {
  if (status === 'never') return null;
  const seal = SEALS[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className}`}
      data-testid="wax-seal"
      data-status={status}
    >
      <svg
        viewBox="0 0 32 32"
        className="w-6 h-6 flex-shrink-0 drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]"
        aria-hidden="true"
      >
        {/* Irregular blob edge, like pressed wax */}
        <path
          d="M16 2c3 0 4 2 7 2.5s5 2 5.5 5-1.5 5 0 8-1 5-3.500 6.500-4 4-7 4-4.500-2-7.500-2.500S4 22 3.500 19 5 13.500 4 10.500 6 6 9 4.500 13 2 16 2z"
          fill={seal.wax}
          stroke={seal.rim}
          strokeWidth="1"
        />
        <circle
          cx="16"
          cy="16"
          r="8"
          fill="none"
          stroke={seal.rim}
          strokeWidth="1.2"
          opacity="0.7"
        />
        {/* Tiny die-like pip in the centre */}
        <path d="M16 11l4.500 5-4.500 5-4.500-5z" fill={seal.rim} opacity="0.65" />
      </svg>
      <span
        className={`text-[11px] font-bold uppercase tracking-wider ${seal.ink}`}
      >
        {seal.label}
      </span>
    </span>
  );
};
