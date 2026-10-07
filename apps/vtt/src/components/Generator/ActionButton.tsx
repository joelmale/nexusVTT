import React from 'react';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import { actionTitle, type GeneratorAction } from './generatorActions';
import styles from './GeneratorSidebar.module.css';

interface ActionButtonProps {
  action: GeneratorAction;
  /** True while the generator has not yet acknowledged this action. */
  pending: boolean;
  onRun: (action: GeneratorAction) => void;
}

/**
 * One registry action. Presets render as chips, everything else as a button
 * with its key hint. Dialog actions are marked with an ellipsis because they
 * open a dialog inside the map rather than changing it directly.
 */
export const ActionButton: React.FC<ActionButtonProps> = ({
  action,
  pending,
  onRun,
}) => {
  const spinner = pending ? (
    <Loader2 size={12} className="animate-spin" aria-hidden="true" />
  ) : null;

  if (action.kind === 'preset') {
    return (
      <button
        type="button"
        className={styles.chip}
        onClick={() => onRun(action)}
        disabled={pending}
        aria-busy={pending || undefined}
        title={actionTitle(action)}
      >
        {spinner}
        <span>{action.label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={styles.actionButton}
      onClick={() => onRun(action)}
      disabled={pending}
      aria-busy={pending || undefined}
      title={actionTitle(action)}
    >
      {spinner}
      <span className={styles.actionLabel}>
        {action.label}
        {action.kind === 'dialog' && !action.label.endsWith('…') && (
          <span className={styles.dialogMark} aria-hidden="true">
            …
          </span>
        )}
      </span>
      <kbd className={styles.kbd}>{action.keyLabel}</kbd>
    </button>
  );
};
