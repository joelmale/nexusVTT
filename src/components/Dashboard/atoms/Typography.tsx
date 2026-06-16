import React, { useEffect } from 'react';

// Dynamically load D&D fantasy fonts when typography is used
export const useTTRPGFonts = () => {
  useEffect(() => {
    const fontId = 'ttrpg-gothic-fonts';
    if (document.getElementById(fontId)) return;

    const link = document.createElement('link');
    link.id = fontId;
    link.href = 'https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Cinzel:wght@400;700;900&family=MedievalSharp&family=Oswald:wght@400;700&family=Uncial+Antiqua&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);
};

interface GothicHeaderProps {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  variant?: 'cinzel' | 'medieval' | 'uncial' | 'oswald';
  className?: string;
  children: React.ReactNode;
  id?: string;
}

export const GothicHeader: React.FC<GothicHeaderProps> = ({
  level = 2,
  variant = 'cinzel',
  className = '',
  children,
  id,
}) => {
  useTTRPGFonts();

  const fontFamilies = {
    cinzel: "font-['Cinzel',serif] tracking-wide",
    medieval: "font-['MedievalSharp',cursive] tracking-normal",
    uncial: "font-['Uncial_Antiqua',cursive] tracking-wider",
    oswald: "font-['Oswald',sans-serif] tracking-tight uppercase",
  };

  const baseStyle = `${fontFamilies[variant]} font-bold text-[#e1d2b8] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]`;
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

  const sizeClasses = {
    1: 'text-3xl md:text-4xl',
    2: 'text-2xl md:text-3xl',
    3: 'text-xl md:text-2xl',
    4: 'text-lg md:text-xl',
    5: 'text-base md:text-lg',
    6: 'text-sm md:text-base',
  };

  return (
    <Tag id={id} className={`${baseStyle} ${sizeClasses[level]} ${className}`}>
      {children}
    </Tag>
  );
};

interface DropCapProps {
  children: string;
  className?: string;
}

export const DropCap: React.FC<DropCapProps> = ({ children, className = '' }) => {
  useTTRPGFonts();
  if (!children) return null;

  const firstLetter = children.charAt(0);
  const restOfText = children.slice(1);

  return (
    <p className={`font-['Cormorant_Garamond',serif] text-lg text-[#362b21] leading-relaxed ${className}`}>
      <span className="font-['Uncial_Antiqua',cursive] text-4xl float-left font-bold text-amber-700 mr-2 mt-1 line-height-none select-none">
        {firstLetter}
      </span>
      {restOfText}
    </p>
  );
};

interface OrnateDividerProps {
  className?: string;
  color?: string;
}

export const OrnateDivider: React.FC<OrnateDividerProps> = ({
  className = '',
  color = 'currentColor',
}) => {
  return (
    <div className={`flex items-center justify-center w-full my-4 select-none opacity-80 ${className}`}>
      <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#8c6b4a]/50 to-[#8c6b4a]" />
      <svg
        viewBox="0 0 100 20"
        className="w-12 h-6 mx-2 text-[#8c6b4a]"
        fill={color}
      >
        {/* Ornate TTRPG divider: horizontal lines framing a center diamond and side scrolls */}
        <path d="M 50 2 L 54 10 L 50 18 L 46 10 Z" />
        <circle cx="38" cy="10" r="2.5" />
        <circle cx="62" cy="10" r="2.5" />
        <path d="M 30 10 C 25 5, 20 5, 15 10 C 10 15, 5 15, 0 10" fill="none" stroke="currentColor" strokeWidth="1" />
        <path d="M 70 10 C 75 5, 80 5, 85 10 C 90 15, 95 15, 100 10" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
      <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-[#8c6b4a]/50 to-[#8c6b4a]" />
    </div>
  );
};
