import React from 'react';

interface SectionDividerProps {
  className?: string;
}

export const SectionDivider: React.FC<SectionDividerProps> = ({ className = '' }) => {
  return (
    <div className={`relative flex items-center justify-center my-4 ${className}`}>
      {/* Horizontal Line Left */}
      <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-[#8c6b4a]/30 to-[#8c6b4a]/50" />
      
      {/* Ornate Center Motif */}
      <div className="mx-3 flex items-center justify-center">
        <svg
          viewBox="0 0 24 24"
          className="w-4 h-4 text-[#8c6b4a]/60"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          {/* Diamond Motif */}
          <polygon points="12,4 18,12 12,20 6,12" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </svg>
      </div>
      
      {/* Horizontal Line Right */}
      <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent via-[#8c6b4a]/30 to-[#8c6b4a]/50" />
    </div>
  );
};
