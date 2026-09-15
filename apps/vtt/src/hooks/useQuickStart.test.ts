/**
 * Tests the quick-start orchestration chain: the step ORDER is load-bearing
 * (room before scene before token) and each failure must be attributed to the
 * step that caused it, so a half-seeded environment is never mistaken for a
 * clean one.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

const devToolsEnabled = vi.fn(() => true);
vi.mock('@/utils/devMode', () => ({
  isDevToolsEnabled: () => devToolsEnabled(),
  isDevMode: () => true,
}));

const quickStartApi = vi.fn();
vi.mock('@/services/devSeed', () => ({ quickStart: () => quickStartApi() }));

const calls: string[] = [];
const createGameRoom = vi.fn(async () => {
  calls.push('room');
  return 'ABCD';
});
const createScene = vi.fn(() => {
  calls.push('scene');
  return { id: 'scene-1' };
});
const autoPlaceCharacterToken = vi.fn(async () => {
  calls.push('token');
});

vi.mock('@/stores/gameStore', () => ({
  useGameStore: {
    getState: () => ({
      isAuthenticated: true,
      user: { id: 'user-1' },
      setUser: vi.fn(),
      createGameRoom,
      createScene,
      autoPlaceCharacterToken,
    }),
  },
}));

vi.mock('@/stores/characterStore', () => ({
  useCharacterStore: { setState: vi.fn() },
}));

vi.mock('@nexus/character-contracts', () => ({
  createEmptyCharacter: (playerId: string) => ({ id: '', name: '', playerId }),
}));

import { useQuickStart } from './useQuickStart';

const SEED = {
  campaign: { id: 'camp-1', name: 'Seeded Campaign', description: 'desc' },
  character: { id: 'char-1', name: 'Hero', ownerId: 'user-1', data: {} },
  scene: { name: 'Seeded Scene' },
};

describe('useQuickStart', () => {
  beforeEach(() => {
    calls.length = 0;
    vi.clearAllMocks();
    devToolsEnabled.mockReturnValue(true);
    quickStartApi.mockResolvedValue(SEED);
  });

  afterEach(() => vi.clearAllMocks());

  it('runs room -> scene -> token in order, then navigates to the canvas', async () => {
    const { result } = renderHook(() => useQuickStart());

    await act(async () => {
      await result.current.start();
    });

    expect(calls).toEqual(['room', 'scene', 'token']);
    expect(createGameRoom).toHaveBeenCalledWith(
      expect.objectContaining({ campaignId: 'camp-1', name: 'Seeded Campaign' }),
      false,
    );
    expect(autoPlaceCharacterToken).toHaveBeenCalledWith('char-1', 'scene-1');
    expect(navigate).toHaveBeenCalledWith('/lobby/game/ABCD');
    expect(result.current.error).toBeNull();
  });

  it('does nothing when the dev tools flag is off', async () => {
    devToolsEnabled.mockReturnValue(false);
    const { result } = renderHook(() => useQuickStart());

    await act(async () => {
      await result.current.start();
    });

    expect(quickStartApi).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('attributes a seeding failure to the seeding step and does not create a room', async () => {
    quickStartApi.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useQuickStart());

    await act(async () => {
      await result.current.start();
    });

    await waitFor(() => expect(result.current.error).toContain('seeding'));
    expect(result.current.error).toContain('boom');
    expect(createGameRoom).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('attributes a scene failure to the scene step and never navigates', async () => {
    createScene.mockImplementationOnce(() => {
      throw new Error('no session');
    });
    const { result } = renderHook(() => useQuickStart());

    await act(async () => {
      await result.current.start();
    });

    await waitFor(() => expect(result.current.error).toContain('scene'));
    expect(autoPlaceCharacterToken).not.toHaveBeenCalled();
    // A half-seeded room must not look like success.
    expect(navigate).not.toHaveBeenCalled();
  });

  it('clears the seeding flag even when a step throws', async () => {
    quickStartApi.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useQuickStart());

    await act(async () => {
      await result.current.start();
    });

    await waitFor(() => expect(result.current.isSeeding).toBe(false));
  });
});
