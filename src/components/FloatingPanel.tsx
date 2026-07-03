import React, { useEffect, useRef } from 'react';
import { Portal } from './Portal';
import styles from './FloatingPanel.module.css';

interface FloatingPanelProps {
  /** Whether the panel is currently open. Controls data-state + focus mgmt. */
  isOpen: boolean;
  /** Called when the panel should close (Escape key). */
  onClose: () => void;
  /** Accessible name for the dialog (role="dialog" aria-label). */
  label: string;
  children: React.ReactNode;
}

/**
 * Portal-mounted floating panel shell (top-right, 320px, transform/opacity
 * animated). Renders unconditionally into #portal-root so the open/close
 * transition can run - visibility is controlled entirely via the
 * `data-state` attribute in FloatingPanel.module.css, never by
 * mount/unmount. `isOpen` still gates whether content stays mounted
 * underneath (the caller may choose to unmount heavy children while closed;
 * this shell doesn't force either choice).
 *
 * Accessibility:
 *  - role="dialog", aria-modal="false" (this is a non-modal floating panel -
 *    it does not block interaction with the map behind it, per ADR-0007's
 *    "overlay, never reflow, never trap" posture), aria-label from `label`.
 *  - Escape closes the panel.
 *  - Focus returns to the element that was focused immediately before the
 *    panel opened (typically the tab button that triggered it).
 */
export const FloatingPanel: React.FC<FloatingPanelProps> = ({
  isOpen,
  onClose,
  label,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Capture the opener's focus when opening, and restore it on close.
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

      // Move focus into the panel so Escape / keyboard users land somewhere
      // sensible. Defer to the next tick so the panel is in the DOM with
      // data-state="open" before we try to focus it.
      const id = window.requestAnimationFrame(() => {
        panelRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(id);
    }

    // Closing: restore focus to whatever was focused before opening.
    previouslyFocusedRef.current?.focus();
    previouslyFocusedRef.current = null;
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <Portal>
      <div
        ref={panelRef}
        className={styles.panel}
        data-state={isOpen ? 'open' : 'closed'}
        role="dialog"
        aria-modal="false"
        aria-label={label}
        aria-hidden={!isOpen}
        tabIndex={-1}
        inert={isOpen ? undefined : true}
      >
        <div className={styles.body}>{children}</div>
      </div>
    </Portal>
  );
};
