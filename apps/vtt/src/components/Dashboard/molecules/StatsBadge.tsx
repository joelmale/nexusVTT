import React from 'react';
import Shield from 'lucide-react/dist/esm/icons/shield';

interface StatsBadgeProps {
  label: string;
  value: number;
  icon?: React.ReactNode;
  className?: string;
}

export const StatsBadge: React.FC<StatsBadgeProps> = ({
  label,
  value,
  icon,
  className = '',
 }) => {
  return (
    <div
      className={`
        inline-flex items-center gap-2.5 px-4 py-2
        bg-[#1c1e22] text-[#f1e6d3]
        border border-[#8c6b4a]/40 rounded-sm
        shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]
        font-['Oswald',sans-serif] tracking-wider uppercase text-xs
        ${className}
      `}
    >
      <span className="text-amber-600 flex-shrink-0">
        {icon || <Shield size={14} className="fill-amber-600/10" />}
      </span>
      <span className="opacity-70 font-semibold">{label}:</span>
      <span className="font-black text-amber-500 text-sm tabular-nums">{value}</span>
    </div>
  );
};
