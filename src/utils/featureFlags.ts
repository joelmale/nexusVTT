/**
 * Minimal feature-flag utility.
 *
 * Flags are stored as a single JSON object under one localStorage key
 * (`nexus-flags`), e.g. `{"floating-panels": false}`. Defaults live in
 * `DEFAULT_FLAGS`; explicit localStorage values always win.
 *
 * `useFlag(name)` re-renders the calling component when the flag changes -
 * either because another tab wrote to localStorage (native `storage` event,
 * which only fires cross-tab) or because `setFlag` was called in this same
 * tab (a same-tab `storage` event does not fire, so we run a tiny
 * subscriber registry in addition).
 */

const STORAGE_KEY = 'nexus-flags';
const DEFAULT_FLAGS: Record<string, boolean> = {
  'floating-panels': true,
};

type FlagListener = () => void;

const listeners = new Set<FlagListener>();

function readFlags(): Record<string, boolean> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, boolean>;
    }
    return {};
  } catch {
    return {};
  }
}

function writeFlags(flags: Record<string, boolean>): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
}

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

/** Read a flag's current value. Defaults come from DEFAULT_FLAGS. */
export function isFlagEnabled(name: string): boolean {
  const flags = readFlags();
  if (Object.prototype.hasOwnProperty.call(flags, name)) {
    return flags[name] === true;
  }
  return DEFAULT_FLAGS[name] === true;
}

/** Set (or clear) a flag. Notifies same-tab and cross-tab subscribers. */
export function setFlag(name: string, on: boolean): void {
  const flags = readFlags();
  flags[name] = on;
  writeFlags(flags);
  notifyListeners();
}

/** Internal: subscribe to any flag change (same-tab or cross-tab). */
function subscribe(listener: FlagListener): () => void {
  listeners.add(listener);

  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      listener();
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage);
  }

  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorage);
    }
  };
}

// React hook - imported lazily-safe via require-free static import since
// this module has no other React dependency; kept side-effect free.
import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * React hook returning the current value of a flag. Re-renders on:
 *  - same-tab `setFlag()` calls (subscriber registry)
 *  - cross-tab localStorage writes (native `storage` event)
 */
export function useFlag(name: string): boolean {
  // Lazy initializer covers the mount-time read; the effect below only
  // needs to (a) resync if `name` itself changes between renders and
  // (b) subscribe for future same-tab/cross-tab changes - it must not
  // call setState unconditionally on every run (react-hooks/set-state-in-effect).
  const [value, setValue] = useState(() => isFlagEnabled(name));
  const nameRef = useRef(name);

  const sync = useCallback(() => {
    setValue(isFlagEnabled(name));
  }, [name]);

  useEffect(() => {
    if (nameRef.current !== name) {
      nameRef.current = name;
      sync();
    }
    return subscribe(sync);
  }, [name, sync]);

  return value;
}
