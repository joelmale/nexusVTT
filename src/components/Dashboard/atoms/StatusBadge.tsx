import React from 'react';

export type BadgeStatus = 'success' | 'warning' | 'info' | 'danger' | 'default';

interface StatusBadgeProps {
  status?: BadgeStatus;
  children: React.ReactNode;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status = 'default',
  children,
  className = '',
}) => {
  const getColors = () => {
    switch (status) {
      case 'success':
        return 'bg-[#14532d]/10 text-[#14532d] border-[#14532d]/30';
      case 'danger':
        return 'bg-[#7f1d1d]/10 text-[#7f1d1d] border-[#7f1d1d]/30';
      case 'warning':
        return 'bg-[#78350f]/10 text-[#78350f] border-[#78350f]/30';
      case 'info':
        return 'bg-[#1e3a8a]/10 text-[#1e3a8a] border-[#1e3a8a]/30';
      default:
        return 'bg-[#2c1e16]/10 text-[#2c1e16] border-[#2c1e16]/20';
    }
  };

  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5 rounded-sm border
        font-['Oswald',sans-serif] text-[9px] font-bold uppercase tracking-wider
        ${getColors()} ${className}
      `}
    >
      {children}
    </span>
  );
};
