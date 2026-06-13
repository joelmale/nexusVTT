import React, { useId, useRef } from 'react';
import '../styles/Tooltip.css';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Modern Tooltip utilizing the native HTML Popover API.
 * This ensures the tooltip is promoted to the browser's top-layer, 
 * preventing it from being clipped by overflow:hidden containers.
 */
export const Tooltip: React.FC<TooltipProps> = React.memo(
  ({ text, children, className }) => {
    const popoverId = useId();
    const popoverRef = useRef<HTMLDivElement>(null);

    const showTooltip = () => {
      try {
        popoverRef.current?.showPopover();
      } catch {
        // Fallback for browsers/contexts where showPopover might fail
      }
    };

    const hideTooltip = () => {
      try {
        popoverRef.current?.hidePopover();
      } catch {
        // Fallback or silent failure
      }
    };

    return (
      <div 
        className={`tooltip-container ${className || ''}`}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
        <div 
          id={popoverId}
          popover="manual"
          ref={popoverRef}
          className="tooltip-box popover-tooltip"
        >
          <div dangerouslySetInnerHTML={{ __html: text }} />
        </div>
      </div>
    );
  },
);
