/**
 * Shared guards for global keyboard shortcuts.
 *
 * There is no central hotkey registry in the app - listeners are attached
 * ad hoc in component effects. These helpers at least keep the two rules every
 * global shortcut must obey in one place.
 */

/**
 * True when the event target is somewhere the user is typing, so a global
 * single-key shortcut must not fire.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true;
  }
  if (target.isContentEditable) return true;
  return target.getAttribute('role') === 'textbox';
}

/**
 * True when no modifier is held.
 *
 * Single-letter shortcuts must check this or they hijack browser chrome -
 * without it `Ctrl+R` matches the "R" tool and `preventDefault()`s reload,
 * and `Ctrl+E`/`Ctrl+O` swallow their browser shortcuts too.
 */
export function isPlainKey(e: KeyboardEvent): boolean {
  return !e.ctrlKey && !e.metaKey && !e.altKey;
}

/** Convenience: a plain single-key shortcut that is safe to handle globally. */
export function isGlobalShortcut(e: KeyboardEvent): boolean {
  return isPlainKey(e) && !isTypingTarget(e.target);
}
