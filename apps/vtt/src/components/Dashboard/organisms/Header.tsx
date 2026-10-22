import React from 'react';
import { GothicHeader } from '../atoms/Typography';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left';

interface HeaderProps {
  userName: string;
  onBack?: () => void;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  userName,
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
      <div className="flex flex-wrap items-center gap-3 min-w-0">
        {onBack && (
          <button
            onClick={onBack}
            className="unstyled 
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
        <div className="hidden sm:block w-1.5 h-8 bg-amber-600 rounded-sm shadow-vtt-amber-glow" />
        <div className="min-w-0">
          <GothicHeader level={1} variant="cinzel" className="!text-[#f1e6d3] !text-xl sm:!text-2xl tracking-wide">
            The Table Awaits, {userName}
          </GothicHeader>
          <p className="text-[11px] font-sans tracking-wide text-amber-500/80 uppercase font-semibold">
            Your tables &amp; heroes
          </p>
        </div>
      </div>
    </header>
  );
};
