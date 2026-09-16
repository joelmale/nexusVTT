import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { isFlagEnabled, setFlag, useFlag } from './featureFlags';

const STORAGE_KEY = 'nexus-flags';

beforeEach(() => {
  localStorage.clear();
});

describe('isFlagEnabled / setFlag', () => {
  it('falls back to DEFAULT_FLAGS when a flag is unset', () => {
    expect(isFlagEnabled('max-hp-sync')).toBe(false);
  });

  it('defaults unknown flags to false when unset', () => {
    expect(isFlagEnabled('unknown-flag')).toBe(false);
  });

  it('setFlag(name, true) persists and isFlagEnabled reflects it', () => {
    setFlag('test-flag', true);
    expect(isFlagEnabled('test-flag')).toBe(true);
  });

  it('setFlag(name, false) clears a previously-set flag', () => {
    setFlag('test-flag', true);
    setFlag('test-flag', false);
    expect(isFlagEnabled('test-flag')).toBe(false);
  });

  it('stores flags as a single JSON object under the nexus-flags key', () => {
    setFlag('test-flag', true);
    setFlag('other-flag', true);
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed).toEqual({ 'test-flag': true, 'other-flag': true });
  });

  it('tolerates corrupt JSON in localStorage (treats as no flags set)', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');
    expect(isFlagEnabled('test-flag')).toBe(false);
    expect(isFlagEnabled('unknown-flag')).toBe(false);
  });

  it('multiple flags are independent', () => {
    setFlag('test-flag', true);
    expect(isFlagEnabled('other-flag')).toBe(false);
    expect(isFlagEnabled('test-flag')).toBe(true);
  });
});

describe('useFlag', () => {
  it('returns the current value on mount', () => {
    setFlag('test-flag', true);
    const { result } = renderHook(() => useFlag('test-flag'));
    expect(result.current).toBe(true);
  });

  it('returns false for a flag that is unset and has no default', () => {
    const { result } = renderHook(() => useFlag('test-flag'));
    expect(result.current).toBe(false);
  });

  it('re-renders when setFlag is called in the same tab', () => {
    setFlag('test-flag', true);
    const { result } = renderHook(() => useFlag('test-flag'));
    expect(result.current).toBe(true);

    act(() => {
      setFlag('test-flag', false);
    });

    expect(result.current).toBe(false);
  });

  it('re-renders when a cross-tab storage event fires for the flags key', () => {
    setFlag('test-flag', true);
    const { result } = renderHook(() => useFlag('test-flag'));
    expect(result.current).toBe(true);

    // Simulate another tab writing the flag directly to localStorage and
    // dispatching the native cross-tab `storage` event (jsdom does not do
    // this automatically for same-document writes).
    act(() => {
      localStorage.setItem(
        STORAGE_KEY,
          JSON.stringify({ 'test-flag': false }),
      );
      window.dispatchEvent(
        new StorageEvent('storage', { key: STORAGE_KEY }),
      );
    });

    expect(result.current).toBe(false);
  });

  it('two independent hook instances both react to a single setFlag call', () => {
    const { result: a } = renderHook(() => useFlag('test-flag'));
    const { result: b } = renderHook(() => useFlag('test-flag'));

    act(() => {
      setFlag('test-flag', true);
    });

    expect(a.current).toBe(true);
    expect(b.current).toBe(true);
  });

  it('unsubscribes on unmount without throwing', () => {
    const { unmount } = renderHook(() => useFlag('test-flag'));
    expect(() => unmount()).not.toThrow();
  });

  it('does not leak listeners across unmounted hooks (setFlag after unmount is a no-op call, not an error)', () => {
    const { unmount } = renderHook(() => useFlag('test-flag'));
    unmount();
    expect(() => setFlag('test-flag', true)).not.toThrow();
  });
});
