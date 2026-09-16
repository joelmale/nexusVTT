import { useEffect, useRef } from 'react';
import { useUIStackStore } from '@/stores/uiStackStore';
import { isGlobalShortcut, isTypingTarget } from '@/utils/hotkeys';

/** Key that toggles focus mode. `F` is unclaimed by every other handler. */
export const FOCUS_MODE_KEY = 'f';

/** Marks an element as floating chrome that focus mode hides. */
export const CHROME_ATTRIBUTE = 'data-chrome';

const FOCUS_MODE_ATTRIBUTE = 'data-focus-mode';
const LIVE_REGION_ID = 'nexus-focus-mode-status';

/**
 * Anything in the modal band owns the screen already - hiding the chrome
 * underneath a modal is meaningless, and hiding the modal is out of scope.
 */
function isModalOpen(): boolean {
  return document.querySelector('[role="dialog"][aria-modal="true"]') !== null;
}

function ensureLiveRegion(): HTMLElement {
  let region = document.getElementById(LIVE_REGION_ID);
  if (!region) {
    region = document.createElement('div');
    region.id = LIVE_REGION_ID;
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('role', 'status');
    // Visually hidden but still announced.
    region.style.cssText =
      'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;';
    document.body.appendChild(region);
  }
  return region;
}

/**
 * Drives immersive "focus mode": one hotkey hides every piece of floating
 * chrome, leaving only the map.
 *
 * Mounted once, by GameUI.
 *
 * The flag is mirrored onto `<html>` rather than onto `.game-layout` because
 * `#portal-root` is a *sibling* of `#root` in index.html - FloatingPanel and
 * the AtlasDock pill render there, so a rule scoped to the layout container
 * could never reach them. `<html>` is an ancestor of both.
 */
export function useFocusModeController(): void {
  const focusMode = useUIStackStore((state) => state.focusMode);
  const toggleFocusMode = useUIStackStore((state) => state.toggleFocusMode);
  const setFocusMode = useUIStackStore((state) => state.setFocusMode);

  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Mirror the flag onto <html>, and reset it if this component goes away
  // (e.g. navigating back to the lobby) so the attribute cannot leak.
  useEffect(() => {
    const root = document.documentElement;
    if (focusMode) {
      root.setAttribute(FOCUS_MODE_ATTRIBUTE, 'on');
    } else {
      root.removeAttribute(FOCUS_MODE_ATTRIBUTE);
    }

    ensureLiveRegion().textContent = focusMode
      ? 'Focus mode on. Press F to show the interface.'
      : 'Focus mode off.';

    return () => {
      root.removeAttribute(FOCUS_MODE_ATTRIBUTE);
    };
  }, [focusMode]);

  useEffect(() => {
    return () => {
      // Leaving the game view must not strand the user in focus mode.
      setFocusMode(false);
      document.getElementById(LIVE_REGION_ID)?.remove();
    };
  }, [setFocusMode]);

  // Move focus out of chrome that is about to become `inert`, and put it back
  // on exit. Without this, marking the focused element's ancestor inert leaves
  // focus nowhere and Tab restarts from the top of the document.
  useEffect(() => {
    if (focusMode) {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.closest(`[${CHROME_ATTRIBUTE}]`)) {
        restoreFocusRef.current = active;
        const scene = document.querySelector<HTMLElement>('.layout-scene');
        scene?.focus();
      }
      return;
    }

    const toRestore = restoreFocusRef.current;
    restoreFocusRef.current = null;
    if (toRestore?.isConnected) {
      toRestore.focus();
    }
  }, [focusMode]);

  // Capture phase + stopImmediatePropagation so the Escape exit does not also
  // trigger the five other window-level Escape listeners (FloatingPanel,
  // AtlasDock, GeneratorOverlay, DocumentViewer, CharacterSheetPopup), which
  // would close every open panel on the way out.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!useUIStackStore.getState().focusMode) return;
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        setFocusMode(false);
        return;
      }

      if (e.key.toLowerCase() !== FOCUS_MODE_KEY) return;
      if (!isGlobalShortcut(e)) return;
      if (isModalOpen()) return;

      e.preventDefault();
      toggleFocusMode();
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [toggleFocusMode, setFocusMode]);
}
