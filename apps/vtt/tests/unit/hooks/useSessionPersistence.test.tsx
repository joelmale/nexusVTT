import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  state: {
    saveSessionState: vi.fn(), loadSessionState: vi.fn(), attemptSessionRecovery: vi.fn(async () => false), clearSessionData: vi.fn(),
    session: { roomCode: 'ROOM' }, sceneState: { scenes: [{ id: 'scene-1' }] }, settings: {}, isRecovering: false,
  },
  persistence: { updateActivity: vi.fn(), checkForReconnection: vi.fn(() => null), getRecoveryData: vi.fn(async () => ({ isValid: true, canReconnect: true, session: { roomCode: 'ROOM' }, gameState: null })), getSessionStats: vi.fn(() => ({ count: 1 })), generateReconnectUrl: vi.fn(() => 'https://example.test/reconnect'), debugStorageState: vi.fn(), clearAll: vi.fn() },
}));
vi.mock('@/stores/gameStore', () => ({ useGameStore: (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state) }));
vi.mock('@/services/sessionPersistence', () => ({ sessionPersistenceService: mocks.persistence }));

import { useSessionPersistence, useSessionRecoveryUI } from '@/hooks/useSessionPersistence';

describe('useSessionPersistence', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); localStorage.clear(); mocks.state.attemptSessionRecovery.mockResolvedValue(false); });
  afterEach(() => vi.useRealTimers());

  it('saves active sessions, exposes manual controls, and runs periodic activity updates', async () => {
    const { result, unmount } = renderHook(() => useSessionPersistence({ saveInterval: 500, enableAutoRecovery: false }));
    expect(mocks.state.saveSessionState).toHaveBeenCalledTimes(1);
    act(() => { result.current.saveNow(); result.current.loadState(); result.current.clearAll(); window.dispatchEvent(new Event('beforeunload')); document.dispatchEvent(new Event('visibilitychange')); vi.advanceTimersByTime(500); });
    expect(mocks.state.saveSessionState).toHaveBeenCalledTimes(4); expect(mocks.state.loadSessionState).toHaveBeenCalledTimes(1); expect(mocks.state.clearSessionData).toHaveBeenCalledTimes(1); expect(mocks.persistence.updateActivity).toHaveBeenCalled();
    expect(result.current.generateReconnectUrl('https://example.test')).toContain('reconnect'); unmount();
  });

  it('attempts recovery after mount but skips OAuth redirects', async () => {
    renderHook(() => useSessionPersistence());
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(mocks.state.attemptSessionRecovery).toHaveBeenCalledTimes(1);
    mocks.state.attemptSessionRecovery.mockClear(); localStorage.setItem('nexus-auth-complete', 'true');
    renderHook(() => useSessionPersistence());
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(mocks.state.attemptSessionRecovery).not.toHaveBeenCalled();
  });

  it('loads recovery UI data and prompts only when reconnection is possible', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { result } = renderHook(() => useSessionRecoveryUI());
    await act(async () => {});
    expect(result.current.hasRecoverableSession).toBe(true); expect(result.current.showRecoveryPrompt()).toBe(true); expect(confirm).toHaveBeenCalled();
  });
});
