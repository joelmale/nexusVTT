import React from 'react';

interface PrimaryInkButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'crimson' | 'forest';
  children: React.ReactNode;
}

export const PrimaryInkButton: React.FC<PrimaryInkButtonProps> = ({
  variant = 'crimson',
  children,
  className = '',
  ...props
}) => {
  const bgClass =
    variant === 'crimson'
      ? 'bg-[#7f1d1d] hover:bg-[#991b1b] active:bg-[#6b1111] text-[#FDFBF7] border-[#8c6b4a]/50'
      : 'bg-[#14532d] hover:bg-[#166534] active:bg-[#14532d] text-[#FDFBF7] border-[#8c6b4a]/50';

  return (
    <button
      className={`
        px-4 py-2 font-['Oswald',sans-serif] text-xs font-bold uppercase tracking-wider
        rounded-sm border shadow-sm transition-all duration-200 cursor-pointer
        hover:shadow-md hover:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-500
        disabled:opacity-40 disabled:cursor-not-allowed
        ${bgClass} ${className}
      `}
      {...props}
    >
      <span className="relative z-10 flex items-center justify-center gap-1.5">{children}</span>
    </button>
  );
};
