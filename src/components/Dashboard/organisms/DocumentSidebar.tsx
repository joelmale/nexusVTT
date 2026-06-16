import React, { useState } from 'react';
import { SearchInput } from '../molecules/SearchInput';
import { GothicHeader } from '../atoms/Typography';
import { LibraryDocument } from '../types';
import BookOpen from 'lucide-react/dist/esm/icons/book-open';
import Filter from 'lucide-react/dist/esm/icons/filter';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import File from 'lucide-react/dist/esm/icons/file';

interface DocumentSidebarProps {
  documents?: LibraryDocument[];
  className?: string;
}

export const DocumentSidebar: React.FC<DocumentSidebarProps> = ({
  documents: _documents = [],
  className = '',
}) => {
  const [search, setSearch] = useState('');
  const [showFilter, setShowFilter] = useState(false);

  // Generate 6 empty placeholders for the 2x3 grid
  const placeholders = Array.from({ length: 6 });

  return (
    <aside
      className={`
        relative flex flex-col p-5 rounded-sm bg-[#252a31] border border-[#8c6b4a]/40 shadow-2xl h-full gap-4
        ${className}
      `}
    >
      <GothicHeader level={3} variant="medieval" className="flex items-center gap-2 border-b border-[#8c6b4a]/30 pb-3">
        <BookOpen size={18} className="text-amber-500" />
        Document Library
      </GothicHeader>

      {/* Search Bar & Filter Button */}
      <div className="flex gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search documents..." />
        <button
          onClick={() => setShowFilter(!showFilter)}
          type="button"
          className="
            p-2 rounded-sm bg-[#1c1e22] text-[#f1e6d3] border border-[#8c6b4a]/40
            hover:border-[#d97706] hover:shadow-vtt-amber-glow transition-all duration-200 cursor-pointer
          "
          title="Filter documents"
        >
          <Filter size={14} />
        </button>
      </div>

      {/* Red Warning Banner */}
      <div
        className="
          flex items-center gap-2.5 p-3 rounded-sm
          bg-[#7f1d1d]/90 border border-red-500/50 text-[#fecaca]
          shadow-[inset_0_1px_2px_rgba(255,255,255,0.1),0_2px_4px_rgba(0,0,0,0.3)]
          animate-pulse
        "
      >
        <AlertCircle size={16} className="text-red-300 flex-shrink-0" />
        <span className="font-['Oswald',sans-serif] font-bold text-xs uppercase tracking-wider">
          ! Document service unavailable
        </span>
      </div>

      {/* Grid container layered over the magical rune background */}
      <div className="relative flex-1 flex items-center justify-center min-h-[20rem] overflow-hidden rounded-sm bg-[#1c1e22]/50 border border-[#8c6b4a]/20">
        
        {/* Magical Rune SVG Background */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40 select-none">
          <svg
            viewBox="0 0 200 200"
            className="w-72 h-72 text-amber-500/20 animate-[spin_60s_linear_infinite]"
          >
            <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="100" cy="100" r="82" fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 4" />
            <circle cx="100" cy="100" r="64" fill="none" stroke="currentColor" strokeWidth="1.2" />
            {/* Hexagram rune */}
            <polygon points="100,15 174,142 26,142" fill="none" stroke="currentColor" strokeWidth="0.6" />
            <polygon points="100,185 174,58 26,58" fill="none" stroke="currentColor" strokeWidth="0.6" />
            <circle cx="100" cy="100" r="35" fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="1.5 2" />
            {/* Concentric markings */}
            <line x1="100" y1="0" x2="100" y2="200" stroke="currentColor" strokeWidth="0.4" strokeDasharray="4 4" />
            <line x1="0" y1="100" x2="200" y2="100" stroke="currentColor" strokeWidth="0.4" strokeDasharray="4 4" />
          </svg>
          {/* Subtle central glow */}
          <div className="absolute w-28 h-28 rounded-full bg-amber-500/10 blur-xl animate-pulse" />
        </div>

        {/* 2x3 Grid of Placeholders */}
        <div className="relative z-10 grid grid-cols-2 grid-rows-3 gap-3 p-4 w-full h-full">
          {placeholders.map((_, idx) => (
            <div
              key={idx}
              className="
                flex flex-col items-center justify-center p-3 rounded-sm
                bg-[#252a31]/60 border border-dashed border-[#8c6b4a]/40
                text-[#cbd5e1]/30 hover:border-amber-600/60 hover:text-amber-500/50 hover:bg-[#252a31]/80
                transition-all duration-300 select-none
              "
            >
              <File size={20} className="stroke-[1.5] mb-1.5" />
              <span className="font-['Oswald',sans-serif] text-[9px] font-bold tracking-widest uppercase">
                Empty Slot
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};
