import React from 'react';
import Search from 'lucide-react/dist/esm/icons/search';

interface SearchInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
}) => {
  return (
    <div className={`relative flex items-center w-full ${className}`}>
      <Search
        size={14}
        className="absolute left-3 text-[#cbd5e1]/40 pointer-events-none"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="
          w-full pl-9 pr-4 py-2 text-sm
          bg-[#1c1e22] text-[#f1e6d3] placeholder:text-[#cbd5e1]/30
          border border-[#8c6b4a]/40 rounded-sm
          outline-none focus:border-[#d97706] focus:shadow-vtt-amber-glow
          transition-all duration-200 font-sans
        "
      />
    </div>
  );
};
