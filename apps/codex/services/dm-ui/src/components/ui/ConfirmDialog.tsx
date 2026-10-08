import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Short explanation under the title. */
  description?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Red confirm button for destructive actions. Defaults to true. */
  destructive?: boolean;
  /** Disables both buttons while the confirmed action runs. */
  busy?: boolean;
  /** Hides the confirm button, e.g. when the action is blocked. */
  hideConfirm?: boolean;
  onConfirm: () => void;
  /** Called by Cancel, Escape and a backdrop click. */
  onCancel: () => void;
  /** Extra body content below the description. */
  children?: React.ReactNode;
}

/**
 * Modal confirmation. Focus starts on Cancel so Enter never confirms a
 * destructive action by accident.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = true,
  busy = false,
  hideConfirm = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const titleId = React.useId();
  const descriptionId = React.useId();
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next && !busy) onCancel();
      }}
      open={open}
    >
      <DialogContent>
        <div
          aria-describedby={description ? descriptionId : undefined}
          aria-labelledby={titleId}
          aria-modal="true"
          role="alertdialog"
        >
          <DialogHeader>
            <DialogTitle>
              <span id={titleId}>{title}</span>
            </DialogTitle>
            {description ? (
              <DialogDescription>
                <span id={descriptionId}>{description}</span>
              </DialogDescription>
            ) : null}
          </DialogHeader>
          {children ? <div className="mt-3">{children}</div> : null}
          <DialogFooter className="mt-4 gap-2">
            <Button
              disabled={busy}
              onClick={onCancel}
              ref={cancelRef}
              type="button"
              variant="outline"
            >
              {cancelLabel}
            </Button>
            {hideConfirm ? null : (
              <Button
                disabled={busy}
                onClick={onConfirm}
                type="button"
                variant={destructive ? 'destructive' : 'default'}
              >
                {confirmLabel}
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
