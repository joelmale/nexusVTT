import React, { useId } from 'react';
import './PopoverMenu.css';

interface PopoverMenuProps {
  /** The clickable node that triggers the popover menu */
  trigger: React.ReactNode;
  /** Content rendered inside the overlay dropdown container */
  children: React.ReactNode;
  /** Optional custom class for the trigger button */
  triggerClassName?: string;
  /** Optional custom class for the inner content container */
  contentClassName?: string;
}

/**
 * Modern, lightweight popover dropdown utilizing the native HTML Popover API.
 * Safely promoted to the browser top-layer, bypassing parent container clipping.
 * Built for NexusVTT following senior engineering standards.
 */
export const PopoverMenu: React.FC<PopoverMenuProps> = ({ 
  trigger, 
  children, 
  triggerClassName = '',
  contentClassName = ''
}) => {
  const popoverId = useId();

  return (
    <div className="popover-menu-container">
      {/* Trigger element binds directly via native targets */}
      <button 
        popoverTarget={popoverId}
        className={`popover-trigger ${triggerClassName}`}
        aria-haspopup="true"
      >
        {trigger}
      </button>

      {/* The popover element itself */}
      <div
        id={popoverId}
        popover="auto"
        className="popover-content"
      >
        <div className={`popover-inner ${contentClassName}`}>
          {children}
        </div>
      </div>
    </div>
  );
};
