import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const gameState = vi.hoisted(() => ({ user: { id: 'p1' } }));
vi.mock('@/stores/gameStore', () => ({
  useGameStore: { getState: () => gameState },
}));

const sendEvent = vi.hoisted(() => vi.fn());
vi.mock('@/services/websocket', () => ({
  webSocketService: { sendEvent },
}));

import {
  handlePlayerIntentResult,
  resetPendingPlayerIntents,
  sendPlayerIntent,
} from '@/services/playerIntentClient';
import type { PlayerIntentMessage } from '../../../shared/events/playerIntent';

const intent = { kind: 'end-turn', combatantId: 'e1' } as const;

describe('playerIntentClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sendEvent.mockReset();
  });
  afterEach(() => {
    resetPendingPlayerIntents();
    vi.useRealTimers();
  });

  it('resolves with the host result addressed to this user', async () => {
    let sent: PlayerIntentMessage | undefined;
    const promise = sendPlayerIntent(intent, {
      sender: (message) => {
        sent = message;
      },
    });
    expect(sent?.intent).toEqual(intent);

    expect(
      handlePlayerIntentResult({
        intentId: sent?.intentId,
        targetUserId: 'someone-else',
        status: 'applied',
      }),
    ).toBe(false);
    expect(
      handlePlayerIntentResult({
        intentId: sent?.intentId,
        targetUserId: 'p1',
        status: 'rejected',
        reason: 'not-your-turn',
      }),
    ).toBe(true);

    await expect(promise).resolves.toEqual({
      intentId: sent?.intentId,
      status: 'rejected',
      reason: 'not-your-turn',
    });
  });

  it('times out as host-offline', async () => {
    const promise = sendPlayerIntent(intent, {
      sender: () => undefined,
      timeoutMs: 1000,
    });
    vi.advanceTimersByTime(1000);
    await expect(promise).resolves.toMatchObject({
      status: 'rejected',
      reason: 'host-offline',
    });
  });

  it('treats a throwing sender as host-offline', async () => {
    const promise = sendPlayerIntent(intent, {
      sender: () => {
        throw new Error('socket closed');
      },
    });
    await expect(promise).resolves.toMatchObject({ reason: 'host-offline' });
  });

  it('sends through the websocket by default', async () => {
    const promise = sendPlayerIntent(intent);
    await vi.waitFor(() => expect(sendEvent).toHaveBeenCalledTimes(1));
    const { type, data } = sendEvent.mock.calls[0][0] as {
      type: string;
      data: PlayerIntentMessage;
    };
    expect(type).toBe('player/intent');
    handlePlayerIntentResult({
      intentId: data.intentId,
      targetUserId: 'p1',
      status: 'applied',
    });
    await expect(promise).resolves.toEqual({
      intentId: data.intentId,
      status: 'applied',
    });
  });

  it('ignores unknown and malformed results', () => {
    expect(handlePlayerIntentResult({ nope: true })).toBe(false);
    expect(
      handlePlayerIntentResult({
        intentId: 'unknown',
        targetUserId: 'p1',
        status: 'applied',
      }),
    ).toBe(false);
  });
});
