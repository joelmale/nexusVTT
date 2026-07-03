import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { isFlagEnabled, setFlag, useFlag } from './featureFlags';

const STORAGE_KEY = 'nexus-flags';

beforeEach(() => {
  localStorage.clear();
});

describe('isFlagEnabled / setFlag', () => {
  it('defaults to false for an unset flag', () => {
    expect(isFlagEnabled('floating-panels')).toBe(false);
  });

  it('setFlag(name, true) persists and isFlagEnabled reflects it', () => {
    setFlag('floating-panels', true);
    expect(isFlagEnabled('floating-panels')).toBe(true);
  });

  it('setFlag(name, false) clears a previously-set flag', () => {
    setFlag('floating-panels', true);
    setFlag('floating-panels', false);
    expect(isFlagEnabled('floating-panels')).toBe(false);
  });

  it('stores flags as a single JSON object under the nexus-flags key', () => {
    setFlag('floating-panels', true);
    setFlag('other-flag', true);
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed).toEqual({ 'floating-panels': true, 'other-flag': true });
  });

  it('tolerates corrupt JSON in localStorage (treats as no flags set)', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');
    expect(isFlagEnabled('floating-panels')).toBe(false);
  });

  it('multiple flags are independent', () => {
    setFlag('floating-panels', true);
    expect(isFlagEnabled('other-flag')).toBe(false);
    expect(isFlagEnabled('floating-panels')).toBe(true);
  });
});

describe('useFlag', () => {
  it('returns the current value on mount', () => {
    setFlag('floating-panels', true);
    const { result } = renderHook(() => useFlag('floating-panels'));
    expect(result.current).toBe(true);
  });

  it('defaults to false when unset', () => {
    const { result } = renderHook(() => useFlag('floating-panels'));
    expect(result.current).toBe(false);
  });

  it('re-renders when setFlag is called in the same tab', () => {
    const { result } = renderHook(() => useFlag('floating-panels'));
    expect(result.current).toBe(false);

    act(() => {
      setFlag('floating-panels', true);
    });

    expect(result.current).toBe(true);
  });

  it('re-renders when a cross-tab storage event fires for the flags key', () => {
    const { result } = renderHook(() => useFlag('floating-panels'));
    expect(result.current).toBe(false);

    // Simulate another tab writing the flag directly to localStorage and
    // dispatching the native cross-tab `storage` event (jsdom does not do
    // this automatically for same-document writes).
    act(() => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ 'floating-panels': true }),
      );
      window.dispatchEvent(
        new StorageEvent('storage', { key: STORAGE_KEY }),
      );
    });

    expect(result.current).toBe(true);
  });

  it('two independent hook instances both react to a single setFlag call', () => {
    const { result: a } = renderHook(() => useFlag('floating-panels'));
    const { result: b } = renderHook(() => useFlag('floating-panels'));

    act(() => {
      setFlag('floating-panels', true);
    });

    expect(a.current).toBe(true);
    expect(b.current).toBe(true);
  });

  it('unsubscribes on unmount without throwing', () => {
    const { unmount } = renderHook(() => useFlag('floating-panels'));
    expect(() => unmount()).not.toThrow();
  });

  it('does not leak listeners across unmounted hooks (setFlag after unmount is a no-op call, not an error)', () => {
    const { unmount } = renderHook(() => useFlag('floating-panels'));
    unmount();
    expect(() => setFlag('floating-panels', true)).not.toThrow();
  });
});
