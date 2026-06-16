import React from 'react';

interface ButtonProps {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  disabled?: boolean;
  variant?: 'bronze' | 'wood' | 'parchment' | 'danger' | 'ghost';
  type?: 'button' | 'submit' | 'reset';
  icon?: React.ReactNode;
  children: React.ReactNode;
  title?: string;
  id?: string;
}

export const Button: React.FC<ButtonProps> = ({
  onClick,
  className = '',
  disabled = false,
  variant = 'bronze',
  type = 'button',
  icon,
  children,
  title,
  id,
}) => {
  const styles = {
    // Brushed bronze metallic appearance
    bronze: `
      bg-gradient-to-b from-[#8c6b4a] via-[#705234] to-[#593d25]
      text-[#f1e6d3]
      border border-[#b89a7a]/60
      shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_4px_rgba(0,0,0,0.4)]
      hover:from-[#a3805c] hover:via-[#846342] hover:to-[#6d4d32]
      hover:border-[#dcb58f]
      active:translate-y-[1px] active:shadow-inner
    `,
    // Brushed wood appearance
    wood: `
      bg-gradient-to-r from-[#4d3219] via-[#3a220e] to-[#4d3219]
      text-[#cbd5e1]
      border border-[#5a3d25]/80
      shadow-[0_2px_5px_rgba(0,0,0,0.5)]
      hover:from-[#5e3e20] hover:via-[#4c2d13] hover:to-[#5e3e20]
      hover:text-[#e2e8f0]
      active:translate-y-[1px]
    `,
    // Aged cream parchment appearance
    parchment: `
      bg-gradient-to-b from-[#f5eee0] to-[#e6d8c0]
      text-[#362b21]
      border border-[#8c6b4a]/40
      shadow-[0_1px_3px_rgba(0,0,0,0.15)]
      hover:from-[#faf5eb] hover:to-[#ebe0cc]
      hover:border-[#8c6b4a]/80
      hover:shadow-vtt-amber-glow
      active:translate-y-[0.5px]
    `,
    // Red danger/rage theme
    danger: `
      bg-gradient-to-b from-[#991b1b] to-[#7f1d1d]
      text-[#fecaca]
      border border-[#b91c1c]/60
      shadow-[0_2px_4px_rgba(0,0,0,0.4)]
      hover:from-[#b91c1c] hover:to-[#991b1b]
      hover:border-red-400
      active:translate-y-[1px]
    `,
    // Subtle borderless button
    ghost: `
      text-[#e1d2b8]
      hover:text-[#f1e6d3]
      hover:bg-[#8c6b4a]/15
      active:bg-[#8c6b4a]/25
    `,
  };

  const baseStyle = `
    inline-flex items-center justify-center gap-2
    px-4 py-2
    rounded-sm
    font-['Oswald',sans-serif] tracking-wide uppercase text-sm font-semibold
    transition-all duration-200
    cursor-pointer
    select-none
    focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500
    disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none
  `;

  return (
    <button
      id={id}
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${baseStyle} ${styles[variant]} ${className}`}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};
