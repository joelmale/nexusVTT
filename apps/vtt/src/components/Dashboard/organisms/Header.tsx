import React from 'react';
import { GothicHeader } from '../atoms/Typography';
import { StatsBadge } from '../molecules/StatsBadge';
import Shield from 'lucide-react/dist/esm/icons/shield';
import Sword from 'lucide-react/dist/esm/icons/sword';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left';

interface HeaderProps {
  userName: string;
  campaignCount: number;
  characterCount: number;
  onBack?: () => void;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  userName,
  campaignCount,
  characterCount,
  onBack,
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
        {onBack && (
          <button
            onClick={onBack}
            className="
              group flex items-center gap-1.5 mr-2
              px-3 py-1.5 rounded-sm
              text-amber-400 text-[11px] font-sans tracking-wide uppercase font-bold
              bg-[#1a1d23] border border-[#8c6b4a]/50
              shadow-[0_3px_0_0_#5a3e28,0_4px_8px_rgba(0,0,0,0.4)]
              hover:shadow-[0_1px_0_0_#5a3e28,0_2px_4px_rgba(0,0,0,0.4)]
              hover:translate-y-[2px]
              active:shadow-none active:translate-y-[3px]
              transition-all duration-100
            "
          >
            <ChevronLeft
              size={13}
              className="transition-transform duration-100 group-hover:-translate-x-0.5"
            />
            Lobby
          </button>
        )}
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
