import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { notifyNextAttempt, useRevealValidation } from './useRevealValidation';

describe('useRevealValidation', () => {
  it('is hidden on arrival', () => {
    const { result } = renderHook(() => useRevealValidation());
    expect(result.current.revealed).toBe(false);
  });

  it('reveals after the player interacts', () => {
    const { result } = renderHook(() => useRevealValidation());
    act(() => result.current.onInteract());
    expect(result.current.revealed).toBe(true);
  });

  it('reveals after a Next attempt', () => {
    const { result } = renderHook(() => useRevealValidation());
    act(() => notifyNextAttempt());
    expect(result.current.revealed).toBe(true);
  });
});
