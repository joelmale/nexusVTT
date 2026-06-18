import React from 'react';

interface ParchmentPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'ivory' | 'vellum';
  glow?: boolean;
  children: React.ReactNode;
}

export const ParchmentPanel: React.FC<ParchmentPanelProps> = ({
  variant = 'ivory',
  glow = false,
  children,
  className = '',
  style,
  ...props
}) => {
  const bgClass = variant === 'ivory' ? 'bg-[#FDFBF7]' : 'bg-[#F4EFE6]';
  const shadowClass = glow
    ? 'shadow-[0_10px_30px_rgba(140,90,30,0.15),0_1px_3px_rgba(0,0,0,0.05)] border-[#8c6b4a]/50'
    : 'shadow-md border-[#8c6b4a]/30';

  return (
    <div
      className={`
        relative p-5 rounded-md border text-[#2C1E16] font-serif
        transition-all duration-300 overflow-hidden select-text
        ${bgClass} ${shadowClass} ${className}
      `}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='paperNoise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.04' numOctaves='5' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.015 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23paperNoise)'/%3E%3C/svg%3E")`,
        ...style,
      }}
      {...props}
    >
      {/* Ornate corner details */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#8c6b4a]/40" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#8c6b4a]/40" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#8c6b4a]/40" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#8c6b4a]/40" />
      
      {/* Content wrapper */}
      <div className="relative z-10">{children}</div>
    </div>
  );
};
