import { v4 as uuidv4 } from 'uuid';
import { useGameStore } from '@/stores/gameStore';
import {
  isAddressedPlayerIntentResult,
  PLAYER_INTENT_EVENT,
  type PlayerIntent,
  type PlayerIntentMessage,
  type PlayerIntentResult,
} from '../../shared/events/playerIntent';

/**
 * Player-side sender for Simple Player Mode intents. There is no optimistic
 * update: callers show a pending state, and the host's next game-state patch
 * is the source of truth. A missing reply resolves as `host-offline`.
 */

export const PLAYER_INTENT_TIMEOUT_MS = 8000;

interface PendingIntent {
  resolve: (result: PlayerIntentResult) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pending = new Map<string, PendingIntent>();

export type IntentSender = (message: PlayerIntentMessage) => void;

async function defaultSender(message: PlayerIntentMessage): Promise<void> {
  const { webSocketService } = await import('@/services/websocket');
  webSocketService.sendEvent({ type: PLAYER_INTENT_EVENT, data: message });
}

export function sendPlayerIntent(
  intent: PlayerIntent,
  options: { timeoutMs?: number; sender?: IntentSender } = {},
): Promise<PlayerIntentResult> {
  const intentId = uuidv4();
  const timeoutMs = options.timeoutMs ?? PLAYER_INTENT_TIMEOUT_MS;

  return new Promise<PlayerIntentResult>((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(intentId);
      resolve({ intentId, status: 'rejected', reason: 'host-offline' });
    }, timeoutMs);
    pending.set(intentId, { resolve, timer });

    const message: PlayerIntentMessage = { intentId, intent };
    try {
      if (options.sender) {
        options.sender(message);
      } else {
        void defaultSender(message).catch(() =>
          settle({ intentId, status: 'rejected', reason: 'host-offline' }),
        );
      }
    } catch {
      settle({ intentId, status: 'rejected', reason: 'host-offline' });
    }
  });
}

function settle(result: PlayerIntentResult): boolean {
  const entry = pending.get(result.intentId);
  if (!entry) return false;
  clearTimeout(entry.timer);
  pending.delete(result.intentId);
  entry.resolve(result);
  return true;
}

/**
 * Handles an incoming `player/intent-result`. Results are fanned out to the
 * room, so anything not addressed to this user is ignored.
 */
export function handlePlayerIntentResult(data: unknown): boolean {
  if (!isAddressedPlayerIntentResult(data)) return false;
  const { user } = useGameStore.getState();
  if (data.targetUserId !== user.id) return false;
  return settle({
    intentId: data.intentId,
    status: data.status,
    ...(data.reason ? { reason: data.reason } : {}),
  });
}

/** Test-only: drop all outstanding intents. */
export function resetPendingPlayerIntents(): void {
  for (const entry of pending.values()) clearTimeout(entry.timer);
  pending.clear();
}
