import { useEffect, useRef, type ReactNode } from 'react';
import styles from './CreatorDialog.module.css';

interface CreatorDialogProps {
  label: string;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}

/** Native modal dialogs provide focus containment, inert background and nested dismissal. */
export function CreatorDialog({
  label,
  onClose,
  className = '',
  children,
}: CreatorDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
    else dialog?.setAttribute('open', '');
    dialog?.focus();
    return () => {
      dialog?.close?.();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={label}
      aria-modal="true"
      tabIndex={-1}
      className={`${styles.dialog} ${className}`}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Tab') {
          const dialog = event.currentTarget;
          const controls = Array.from(
            dialog.querySelectorAll<HTMLElement>(
              'button, a[href], input, select, textarea, [tabindex]',
            ),
          ).filter(
            (element) =>
              element.tabIndex >= 0 &&
              !element.matches(':disabled') &&
              element.getClientRects().length > 0,
          );
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (!first) {
            event.preventDefault();
            dialog.focus();
          } else if (
            event.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === dialog)
          ) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      {children}
    </dialog>
  );
}
