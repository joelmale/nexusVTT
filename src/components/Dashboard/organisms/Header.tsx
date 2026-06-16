import React from 'react';
import { GothicHeader } from '../atoms/Typography';
import { StatsBadge } from '../molecules/StatsBadge';
import Shield from 'lucide-react/dist/esm/icons/shield';
import Sword from 'lucide-react/dist/esm/icons/sword';

interface HeaderProps {
  userName: string;
  campaignCount: number;
  characterCount: number;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  userName,
  campaignCount,
  characterCount,
  className = '',
}) => {
  return (
    <header
      className={`
        flex flex-col md:flex-row md:items-center justify-between
        p-6 rounded-md bg-[#252a31] border border-[#8c6b4a]/30 shadow-2xl
        gap-4 select-none
        ${className}
      `}
    >
      {/* Welcome Message (Left) */}
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-8 bg-amber-600 rounded-sm shadow-vtt-amber-glow" />
        <div>
          <GothicHeader level={1} variant="cinzel" className="!text-[#f1e6d3] text-2xl tracking-wide">
            Welcome, {userName}!
          </GothicHeader>
          <p className="text-[11px] font-sans tracking-wide text-amber-500/80 uppercase font-semibold">
            Player Dashboard &bull; Beta Version
          </p>
        </div>
      </div>

      {/* Stats Widgets (Right) */}
      <div className="flex flex-wrap items-center gap-3">
        <StatsBadge
          label="Campaigns"
          value={campaignCount}
          icon={<Shield size={14} className="fill-amber-600/10" />}
        />
        <StatsBadge
          label="Characters"
          value={characterCount}
          icon={<Sword size={14} />}
        />
      </div>
    </header>
  );
};
