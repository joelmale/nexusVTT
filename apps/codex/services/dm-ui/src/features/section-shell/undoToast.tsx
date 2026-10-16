import { createRoot, type Root } from 'react-dom/client';

import styles from './RemoveItemButton.module.css';

export interface UndoToastOptions {
  message: string;
  /** Runs when Undo is pressed. Resolve to an error message on failure. */
  onUndo: () => Promise<string | undefined>;
  /** Milliseconds before the toast dismisses itself. Defaults to 10000. */
  durationMs?: number;
}

let container: HTMLDivElement | undefined;
let root: Root | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;

function dismiss() {
  if (timer) clearTimeout(timer);
  timer = undefined;
  const mounted = root;
  const host = container;
  root = undefined;
  container = undefined;
  // Defer: unmounting during a React event handler warns.
  queueMicrotask(() => {
    mounted?.unmount();
    host?.remove();
  });
}

/**
 * Shows a transient "removed, Undo" notice outside the React tree of the
 * caller. The pane that triggered a removal unmounts as soon as the item
 * leaves the bundle, so the notice cannot live inside it.
 */
export function showUndoToast({
  message,
  onUndo,
  durationMs = 10_000,
}: UndoToastOptions): void {
  dismiss();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  const render = (error?: string, busy = false) => {
    root?.render(
      <div className={styles.toast} role="status">
        <span>{error ? `${message} ${error}` : message}</span>
        <button
          className={styles.undo}
          disabled={busy}
          onClick={async () => {
            if (timer) clearTimeout(timer);
            render(undefined, true);
            const failure = await onUndo();
            if (failure) render(`Undo failed: ${failure}`);
            else dismiss();
          }}
          type="button"
        >
          Undo
        </button>
        <button
          aria-label="Dismiss"
          className={styles.dismiss}
          onClick={dismiss}
          type="button"
        >
          ×
        </button>
      </div>,
    );
  };
  render();
  timer = setTimeout(dismiss, durationMs);
}

/** Removes any visible toast immediately (used by tests). */
export function clearUndoToast(): void {
  dismiss();
}
