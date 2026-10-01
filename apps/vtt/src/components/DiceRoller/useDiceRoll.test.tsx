import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDiceRoll } from './useDiceRoll';
import { useGameStore, useIsHost } from '@/stores/gameStore';
import { webSocketService } from '@/services/websocket';

vi.mock('@/stores/gameStore', () => ({
  useGameStore: vi.fn(),
  useIsHost: vi.fn(),
}));

vi.mock('@/services/websocket', () => ({
  webSocketService: {
    isConnected: vi.fn(() => true),
    sendEvent: vi.fn(),
  },
}));

interface MockState {
  user: { id: string; name: string };
  sendChatMessage: ReturnType<typeof vi.fn>;
  addDiceRoll: ReturnType<typeof vi.fn>;
}

describe('useDiceRoll', () => {
  const state: MockState = {
    user: { id: 'u1', name: 'Joel' },
    sendChatMessage: vi.fn(),
    addDiceRoll: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(webSocketService.isConnected).mockReturnValue(true);
    vi.mocked(useIsHost).mockReturnValue(true);
    vi.mocked(useGameStore).mockImplementation(((
      selector?: (s: MockState) => unknown,
    ) => (selector ? selector(state) : state)) as unknown as typeof useGameStore);
    (useGameStore as unknown as { getState: () => MockState }).getState = () =>
      state;
  });

  it('rejects an empty expression', () => {
    const { result } = renderHook(() => useDiceRoll({ isPrivate: false }));
    expect(result.current.roll('   ')).toBe('Please provide a dice expression');
    expect(webSocketService.sendEvent).not.toHaveBeenCalled();
  });

  it('rejects an invalid expression', () => {
    const { result } = renderHook(() => useDiceRoll({ isPrivate: false }));
    expect(result.current.roll('banana')).toBe('Invalid expression: banana');
    expect(webSocketService.sendEvent).not.toHaveBeenCalled();
  });

  it('online: strips /r, requests the roll, posts chat, skips the local store', async () => {
    const { result } = renderHook(() => useDiceRoll({ isPrivate: true }));
    let error: string | null = 'unset';
    act(() => {
      error = result.current.roll('/r 1d20+2', 'advantage');
    });
    expect(error).toBeNull();
    await waitFor(() =>
      expect(webSocketService.sendEvent).toHaveBeenCalledWith({
        type: 'dice/roll-request',
        data: {
          expression: '1d20+2',
          isPrivate: true,
          advantage: true,
          disadvantage: false,
        },
      }),
    );
    expect(state.sendChatMessage).toHaveBeenCalledWith(
      'rolled 1d20+2',
      'dice-roll',
      undefined,
      expect.objectContaining({ rollType: 'advantage', modifier: 2 }),
    );
    expect(state.addDiceRoll).not.toHaveBeenCalled();
  });

  it('only marks rolls private for the host', async () => {
    vi.mocked(useIsHost).mockReturnValue(false);
    const { result } = renderHook(() => useDiceRoll({ isPrivate: true }));
    act(() => {
      result.current.roll('1d6');
    });
    await waitFor(() => expect(webSocketService.sendEvent).toHaveBeenCalled());
    expect(
      (vi.mocked(webSocketService.sendEvent).mock.calls[0][0] as {
        data: { isPrivate: boolean };
      }).data.isPrivate,
    ).toBe(false);
  });

  it('offline: adds the roll locally and does not send a request', async () => {
    vi.mocked(webSocketService.isConnected).mockReturnValue(false);
    const { result } = renderHook(() => useDiceRoll({ isPrivate: false }));
    act(() => {
      result.current.roll('2d6', 'disadvantage');
    });
    expect(state.addDiceRoll).toHaveBeenCalledWith(
      expect.objectContaining({ expression: '2d6' }),
    );
    await waitFor(() => expect(state.sendChatMessage).toHaveBeenCalled());
    expect(webSocketService.sendEvent).not.toHaveBeenCalled();
  });
});
