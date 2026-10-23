import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '@nexus/character-contracts';

const sendPlayerIntent = vi.hoisted(() => vi.fn());
vi.mock('@/services/playerIntentClient', () => ({ sendPlayerIntent }));
const applyPlayerIntent = vi.hoisted(() => vi.fn());
vi.mock('@/services/playerIntentApplier', () => ({ applyPlayerIntent }));
const websocket = vi.hoisted(() => ({
  isConnected: vi.fn(() => true),
  reconnect: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/services/websocket', () => ({ webSocketService: websocket }));
const dispatchRoll = vi.hoisted(() => vi.fn());
vi.mock('@/components/DiceRoller/useDiceRoll', () => ({
  useDiceRoll: () => ({ roll: dispatchRoll }),
}));
const lifecycle = vi.hoisted(() => ({
  options: undefined as
    { isSocketOpen: () => boolean; onResumeSession: () => unknown } | undefined,
}));
vi.mock('@/hooks/useMobileSessionLifecycle', () => ({
  useMobileSessionLifecycle: (options: typeof lifecycle.options) => {
    lifecycle.options = options;
    return { connectionState: 'connected' };
  },
}));
vi.mock('@/utils/dataManager', () => ({
  getDataManager: () => ({ getWeapons: () => [] }),
}));
const toastError = vi.hoisted(() => vi.fn());
vi.mock('@/utils/notifications', () => ({
  toast: { error: toastError, info: vi.fn() },
}));
vi.mock('@/services/characterSyncService', () => ({
  characterSyncService: { syncStats: vi.fn() },
}));

import { useSimplePlayerSession } from '@/components/simple-player/useSimplePlayerSession';
import { useCharacterStore } from '@/stores/characterStore';
import { useGameStore } from '@/stores/gameStore';
import { useHandoutFeedStore } from '@/stores/handoutFeedStore';
import { useInitiativeStore } from '@/stores/initiativeStore';

function character(id: string, playerId?: string): Character {
  return {
    id,
    name: id,
    hitPoints: 10,
    abilities: {},
    skills: {},
    playerId,
  } as unknown as Character;
}

function setUser(type: 'player' | 'host', isSpectator = false) {
  useGameStore.setState((state) => {
    state.user.id = 'p1';
    state.user.name = 'Mia';
    state.user.type = type;
    state.user.isSpectator = isSpectator;
  });
}

describe('useSimplePlayerSession', () => {
  beforeEach(() => {
    sendPlayerIntent.mockReset();
    sendPlayerIntent.mockResolvedValue({ intentId: 'i', status: 'applied' });
    applyPlayerIntent.mockReset();
    applyPlayerIntent.mockReturnValue({ intentId: 'i', status: 'applied' });
    dispatchRoll.mockReset();
    toastError.mockReset();
    setUser('player');
    useGameStore.setState((state) => {
      state.diceRolls = [
        { id: 'r1', userId: 'p2', isPrivate: true } as never,
        { id: 'r2', userId: 'p1', isPrivate: true } as never,
        { id: 'r3', userId: 'p2' } as never,
      ];
    });
    useCharacterStore.setState({
      characters: [character('c1', 'p1'), character('c2', 'p2')],
      activeCharacterId: null,
    });
    useInitiativeStore.getState().reset();
    useHandoutFeedStore.getState().reset();
  });

  it('derives my character, owned ids and visible rolls', () => {
    const { result } = renderHook(() => useSimplePlayerSession());
    expect(result.current.myCharacter?.id).toBe('c1');
    expect([...result.current.ownedCharacterIds]).toEqual(['c1']);
    expect(result.current.visibleRolls.map((r) => r.id)).toEqual(['r2', 'r3']);
    expect(result.current.isSpectator).toBe(false);
    expect(result.current.combat.isInCombat).toBe(false);
  });

  it('gives spectators no character', () => {
    setUser('player', true);
    const { result } = renderHook(() => useSimplePlayerSession());
    expect(result.current.myCharacter).toBeUndefined();
  });

  it('sends HP changes as intents and tracks the pending state', async () => {
    let resolve: ((v: unknown) => void) | undefined;
    sendPlayerIntent.mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const { result } = renderHook(() => useSimplePlayerSession());
    let done: Promise<void> | undefined;
    act(() => {
      done = result.current.adjustHp(-3);
    });
    expect(result.current.pendingIntent).toBe('hp');
    expect(sendPlayerIntent).toHaveBeenCalledWith({
      kind: 'hp-adjust',
      characterId: 'c1',
      delta: -3,
    });
    await act(async () => {
      resolve?.({ intentId: 'i', status: 'rejected', reason: 'host-offline' });
      await done;
    });
    expect(result.current.pendingIntent).toBeUndefined();
    expect(result.current.hostAway).toBe(true);
    expect(toastError).not.toHaveBeenCalled();
  });

  it('toasts other rejections', async () => {
    sendPlayerIntent.mockResolvedValueOnce({
      intentId: 'i',
      status: 'rejected',
      reason: 'not-your-turn',
    });
    sendPlayerIntent.mockResolvedValueOnce({
      intentId: 'i',
      status: 'rejected',
    });
    const { result } = renderHook(() => useSimplePlayerSession());
    await act(() => result.current.deathSave('failure'));
    expect(toastError).toHaveBeenCalledWith("It's not your turn any more.");
    await act(() => result.current.deathSave('success'));
    expect(toastError).toHaveBeenLastCalledWith(
      'The DM could not apply that change.',
    );
  });

  it('ends my turn when I have a combatant', async () => {
    const mine = useInitiativeStore.getState().addEntry({
      name: 'c1',
      type: 'player',
      initiative: 10,
      maxHP: 10,
      currentHP: 10,
      tempHP: 0,
      armorClass: 10,
      conditions: [],
      isActive: false,
      isReady: false,
      isDelayed: false,
      characterId: 'c1',
      notes: '',
      deathSaves: { successes: 0, failures: 0 },
      initiativeModifier: 0,
      dexterityModifier: 0,
    });
    const { result } = renderHook(() => useSimplePlayerSession());
    await act(() => result.current.endTurn());
    expect(sendPlayerIntent).toHaveBeenCalledWith({
      kind: 'end-turn',
      combatantId: mine,
    });
  });

  it('does nothing without a character or combatant', async () => {
    useCharacterStore.setState({ characters: [] });
    const { result } = renderHook(() => useSimplePlayerSession());
    await act(async () => {
      await result.current.adjustHp(1);
      await result.current.deathSave('success');
      await result.current.endTurn();
    });
    expect(sendPlayerIntent).not.toHaveBeenCalled();
  });

  it('claims a character and makes it active once the DM accepts', async () => {
    const { result } = renderHook(() => useSimplePlayerSession());
    await act(async () => {
      await result.current.claimCharacter('c2');
    });
    expect(useCharacterStore.getState().activeCharacterId).toBe('c2');

    sendPlayerIntent.mockResolvedValueOnce({
      intentId: 'i',
      status: 'rejected',
      reason: 'not-owner',
    });
    await act(async () => {
      await result.current.claimCharacter('c1');
    });
    expect(useCharacterStore.getState().activeCharacterId).toBe('c2');
  });

  it('submits a created character', async () => {
    const { result } = renderHook(() => useSimplePlayerSession());
    await act(async () => {
      await result.current.submitCharacter(character('new'));
    });
    expect(sendPlayerIntent).toHaveBeenCalledWith({
      kind: 'submit-character',
      character: expect.objectContaining({ id: 'new' }),
    });
  });

  it('applies intents locally when the DM previews simple mode', async () => {
    setUser('host');
    const { result } = renderHook(() => useSimplePlayerSession());
    await act(() => result.current.adjustHp(2));
    expect(sendPlayerIntent).not.toHaveBeenCalled();
    expect(applyPlayerIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        fromUserId: 'p1',
        fromUserName: 'Mia',
        intent: { kind: 'hp-adjust', characterId: 'c1', delta: 2 },
      }),
    );
  });

  it('rolls through the dice pipeline and reports bad expressions', () => {
    dispatchRoll.mockReturnValueOnce(null).mockReturnValueOnce('Invalid');
    const { result } = renderHook(() => useSimplePlayerSession());
    result.current.roll('1d20+5', 'advantage', 'Stealth');
    expect(dispatchRoll).toHaveBeenCalledWith('1d20+5', 'advantage', 'Stealth');
    expect(toastError).not.toHaveBeenCalled();
    result.current.roll('bad', 'none');
    expect(toastError).toHaveBeenCalledWith('Invalid');
  });

  it('exposes handouts and the spotlight', async () => {
    const { result } = renderHook(() => useSimplePlayerSession());
    act(() => {
      useHandoutFeedStore
        .getState()
        .addHandout({ id: 'h', title: 'Map', url: '/m.png', revealedAt: 0 });
    });
    await waitFor(() => expect(result.current.spotlight?.id).toBe('h'));
    act(() => result.current.dismissSpotlight());
    expect(result.current.spotlight).toBeUndefined();
    act(() => result.current.openHandout('h'));
    expect(result.current.spotlight?.id).toBe('h');
  });

  it('wires session resume to the websocket reconnect', () => {
    renderHook(() => useSimplePlayerSession());
    expect(lifecycle.options?.isSocketOpen()).toBe(true);
    void lifecycle.options?.onResumeSession();
    expect(websocket.reconnect).toHaveBeenCalledWith('resume');
  });
});
