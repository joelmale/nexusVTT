import React, { useCallback, useEffect, useRef } from 'react';

interface GeneratorOverlayProps {
  /** Whether the overlay is currently mounted/open. */
  isOpen: boolean;
  /** Called on Escape or the manual close button. */
  onClose: () => void;
  /** `true` under the `floating-panels` flag - the legacy header carve-out
   * (top: var(--header-height)) no longer applies, so the overlay should
   * cover the full viewport (inset: 0). Flag off (default/undefined):
   * unchanged legacy behavior via GeneratorPanel.css. */
  floatingPanelsEnabled?: boolean;
  children: React.ReactNode;
}

/**
 * A6c: modal hygiene wrapper for the GeneratorPanel overlay. Previously the
 * overlay in GameUI.tsx had no Escape handling, no focus trap, and no focus
 * restore (manual X close button only). Conventions copied from
 * FloatingPanel.tsx (focus capture on open / restore on close, Escape
 * closes) plus a real Tab-cycling focus trap, since this overlay is a true
 * modal (aria-modal="true") rather than FloatingPanel's non-modal dialog.
 *
 * This is a hygiene fix, not a layout change - it is mounted unconditionally
 * by GameUI.tsx (not flag-gated); only the inset/top styling branches on
 * `floatingPanelsEnabled` via the `data-floating-panels` attribute consumed
 * in GeneratorPanel.css.
 */
export const GeneratorOverlay: React.FC<GeneratorOverlayProps> = ({
  isOpen,
  onClose,
  floatingPanelsEnabled,
  children,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const getFocusable = useCallback((): HTMLElement[] => {
    const overlay = overlayRef.current;
    if (!overlay) return [];
    return Array.from(
      overlay.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute('disabled'));
  }, []);

  // Capture the opener's focus when opening, move focus into the overlay,
  // and restore it on close.
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

      const id = window.requestAnimationFrame(() => {
        const [first] = getFocusable();
        (first ?? overlayRef.current)?.focus();
      });
      return () => window.cancelAnimationFrame(id);
    }

    previouslyFocusedRef.current?.focus();
    previouslyFocusedRef.current = null;
    return undefined;
  }, [isOpen, getFocusable]);

  // Escape closes; Tab/Shift+Tab cycle within the overlay only.
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const focusable = getFocusable();
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        } else if (!overlayRef.current?.contains(active)) {
          // Focus escaped the overlay (e.g. iframe blur) - pull it back in.
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, getFocusable]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="generator-overlay"
      data-floating-panels={floatingPanelsEnabled ? 'true' : undefined}
      role="dialog"
      aria-modal="true"
      aria-label="Map generator"
      tabIndex={-1}
    >
      <button
        className="generator-overlay-close"
        onClick={onClose}
        title="Close generator and return to scene"
      >
        ✕
      </button>
      <div className="generator-overlay-content">{children}</div>
    </div>
  );
};
