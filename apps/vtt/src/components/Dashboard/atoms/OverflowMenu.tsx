import React, { useEffect, useId, useRef, useState } from 'react';
import MoreHorizontal from 'lucide-react/dist/esm/icons/more-horizontal';

export interface OverflowMenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

interface OverflowMenuProps {
  items: OverflowMenuItem[];
  /** Accessible name for the trigger, e.g. "More actions for Strahd". */
  label: string;
  className?: string;
}

/**
 * Small `⋯` menu for secondary or destructive card actions. Closes on an
 * outside click or Escape. Renders nothing when there are no items.
 */
export const OverflowMenu: React.FC<OverflowMenuProps> = ({
  items,
  label,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className="unstyled 
          flex items-center justify-center w-7 h-7 rounded-sm cursor-pointer
          text-[#362b21]/75 hover:text-[#362b21] hover:bg-[#8c6b4a]/15
          focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500
        "
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className="
            absolute right-0 bottom-full mb-1 z-20 min-w-[8rem] py-1 rounded-sm
            bg-[#EFE8D8] border border-[#8c6b4a]/60 shadow-[0_4px_8px_rgba(0,0,0,0.4)]
          "
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={`unstyled 
                block w-full text-left px-3 py-1.5 text-xs font-bold cursor-pointer
                hover:bg-[#8c6b4a]/15 focus:outline-none focus-visible:bg-[#8c6b4a]/20
                ${item.danger ? 'text-[#7f1d1d]' : 'text-[#362b21]'}
              `}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
