import React from 'react';
import type { DashboardRole } from '../types';

interface RoleRibbonProps {
  role: DashboardRole;
  className?: string;
}

const RIBBONS: Record<DashboardRole, { label: string; bg: string }> = {
  dm: { label: 'Dungeon Master', bg: 'bg-gradient-to-b from-[#9b1c1c] to-[#7a1414]' },
  player: { label: 'Adventurer', bg: 'bg-gradient-to-b from-[#3f6285] to-[#2f4b68]' },
};

/** Bookmark ribbon marking the user's role at a table. Position it from the parent. */
export const RoleRibbon: React.FC<RoleRibbonProps> = ({
  role,
  className = '',
}) => {
  const ribbon = RIBBONS[role];
  return (
    <span
      data-testid="role-ribbon"
      className={`
        inline-block px-2.5 pt-1.5 pb-3 text-[11px] font-bold uppercase
        tracking-wider text-[#f8efe0] whitespace-nowrap
        shadow-[0_2px_3px_rgba(0,0,0,0.35)] ${ribbon.bg} ${className}
      `}
      style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%)' }}
    >
      {ribbon.label}
    </span>
  );
};
