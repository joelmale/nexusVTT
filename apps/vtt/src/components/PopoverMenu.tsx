import React, { useId, useRef, useEffect } from 'react';
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // The native Popover API promotes [popover] elements to the top layer,
  // but does NOT anchor them near their invoker unless CSS anchor
  // positioning is explicitly wired up (patchy browser support). Without
  // this, the popover renders at its default top-layer position -- which in
  // practice lands at the document's top-left, nowhere near the button that
  // opened it. Position it by hand off the trigger's rect instead.
  useEffect(() => {
    const popoverEl = contentRef.current;
    const triggerEl = triggerRef.current;
    if (!popoverEl || !triggerEl) return undefined;

    const positionPopover = () => {
      const rect = triggerEl.getBoundingClientRect();
      const menuWidth = popoverEl.offsetWidth;
      const menuHeight = popoverEl.offsetHeight;
      const margin = 8;

      // Prefer opening below-left of the trigger; flip to whichever side
      // keeps the menu on-screen instead of clipping off an edge.
      let left = rect.left;
      if (left + menuWidth > window.innerWidth - margin) {
        left = Math.max(margin, rect.right - menuWidth);
      }

      let top = rect.bottom + 4;
      if (top + menuHeight > window.innerHeight - margin) {
        top = Math.max(margin, rect.top - menuHeight - 4);
      }

      popoverEl.style.position = 'fixed';
      popoverEl.style.margin = '0';
      popoverEl.style.left = `${left}px`;
      popoverEl.style.top = `${top}px`;
    };

    // 'toggle' fires after the popover's open/closed state changes -- by
    // then it's laid out (offsetWidth/Height are real), so positioning here
    // lands before the CSS opacity/transform transition paints it in.
    const handleToggle = (event: Event) => {
      const toggleEvent = event as Event & { newState?: string };
      if (toggleEvent.newState === 'open') {
        positionPopover();
      }
    };

    popoverEl.addEventListener('toggle', handleToggle);
    return () => popoverEl.removeEventListener('toggle', handleToggle);
  }, []);

  return (
    <div className="popover-menu-container">
      {/* Trigger element binds directly via native targets */}
      <button
        ref={triggerRef}
        popoverTarget={popoverId}
        className={`popover-trigger ${triggerClassName}`}
        aria-haspopup="true"
      >
        {trigger}
      </button>

      {/* The popover element itself */}
      <div
        ref={contentRef}
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
