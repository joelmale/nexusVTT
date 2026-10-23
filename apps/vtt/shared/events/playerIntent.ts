/**
 * Player intents are narrow requests a non-host player sends to the room's
 * host. Players never publish canonical game state (only the host does), so
 * Simple Player Mode routes every player-originated change other than token
 * moves through this channel: the server forwards the intent to the host, the
 * host applies it with ordinary store actions, and the host's normal
 * game-state publish makes it durable.
 */

export const PLAYER_INTENT_EVENT = 'player/intent';
export const PLAYER_INTENT_RESULT_EVENT = 'player/intent-result';

export const MAX_HP_DELTA = 999;
export const MAX_TEMP_HP = 999;
const MAX_ID_LENGTH = 128;
const MAX_CONDITION_LENGTH = 64;

export type PlayerIntent =
  | { kind: 'hp-adjust'; characterId: string; delta: number }
  | { kind: 'temp-hp-set'; characterId: string; value: number }
  | { kind: 'condition-toggle'; characterId: string; condition: string }
  | { kind: 'end-turn'; combatantId: string }
  | { kind: 'claim-character'; characterId: string }
  /**
   * A character the player built on their own device with the shared creator.
   * Typed loosely here (shared code can't depend on the client contracts);
   * the host checks its shape before adopting it.
   */
  | { kind: 'submit-character'; character: SubmittedCharacter }
  | {
      kind: 'death-save';
      characterId: string;
      result: 'success' | 'failure';
    };

export interface SubmittedCharacter {
  id: string;
  name: string;
  hitPoints: number;
  abilities: Record<string, unknown>;
  [key: string]: unknown;
}

/** Upper bound on a submitted character's serialized size. */
export const MAX_SUBMITTED_CHARACTER_BYTES = 64 * 1024;

export type PlayerIntentKind = PlayerIntent['kind'];

export interface PlayerIntentMessage {
  intentId: string;
  intent: PlayerIntent;
}

/** The intent as the host receives it, stamped by the server. */
export interface ForwardedPlayerIntent extends PlayerIntentMessage {
  fromUserId: string;
  fromUserName: string;
}

export type PlayerIntentRejectReason =
  'not-owner' | 'not-your-turn' | 'host-offline' | 'invalid' | 'spectator';

export interface PlayerIntentResult {
  intentId: string;
  status: 'applied' | 'rejected';
  reason?: PlayerIntentRejectReason;
}

/** The result as it travels from the host back through the server. */
export interface AddressedPlayerIntentResult extends PlayerIntentResult {
  targetUserId: string;
}

const REJECT_REASONS = new Set<string>([
  'not-owner',
  'not-your-turn',
  'host-offline',
  'invalid',
  'spectator',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_ID_LENGTH
  );
}

function isBoundedInteger(value: unknown, min: number, max: number): boolean {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}

export function isSubmittedCharacter(
  value: unknown,
): value is SubmittedCharacter {
  if (!isRecord(value)) return false;
  if (
    !isId(value.id) ||
    typeof value.name !== 'string' ||
    value.name.trim().length === 0 ||
    value.name.length > 100 ||
    !isBoundedInteger(value.hitPoints, 0, 9999) ||
    !isRecord(value.abilities)
  ) {
    return false;
  }
  try {
    return JSON.stringify(value).length <= MAX_SUBMITTED_CHARACTER_BYTES;
  } catch {
    return false;
  }
}

export function isPlayerIntent(value: unknown): value is PlayerIntent {
  if (!isRecord(value)) return false;
  switch (value.kind) {
    case 'hp-adjust':
      return (
        isId(value.characterId) &&
        isBoundedInteger(value.delta, -MAX_HP_DELTA, MAX_HP_DELTA) &&
        value.delta !== 0
      );
    case 'temp-hp-set':
      return (
        isId(value.characterId) && isBoundedInteger(value.value, 0, MAX_TEMP_HP)
      );
    case 'condition-toggle':
      return (
        isId(value.characterId) &&
        typeof value.condition === 'string' &&
        value.condition.trim().length > 0 &&
        value.condition.length <= MAX_CONDITION_LENGTH
      );
    case 'end-turn':
      return isId(value.combatantId);
    case 'claim-character':
      return isId(value.characterId);
    case 'submit-character':
      return isSubmittedCharacter(value.character);
    case 'death-save':
      return (
        isId(value.characterId) &&
        (value.result === 'success' || value.result === 'failure')
      );
    default:
      return false;
  }
}

export function isPlayerIntentMessage(
  value: unknown,
): value is PlayerIntentMessage {
  return (
    isRecord(value) && isId(value.intentId) && isPlayerIntent(value.intent)
  );
}

export function isForwardedPlayerIntent(
  value: unknown,
): value is ForwardedPlayerIntent {
  return (
    isPlayerIntentMessage(value) &&
    isId((value as unknown as Record<string, unknown>).fromUserId) &&
    typeof (value as unknown as Record<string, unknown>).fromUserName ===
      'string'
  );
}

export function isAddressedPlayerIntentResult(
  value: unknown,
): value is AddressedPlayerIntentResult {
  if (!isRecord(value)) return false;
  if (!isId(value.intentId) || !isId(value.targetUserId)) return false;
  if (value.status === 'applied') return value.reason === undefined;
  return (
    value.status === 'rejected' &&
    (value.reason === undefined ||
      (typeof value.reason === 'string' && REJECT_REASONS.has(value.reason)))
  );
}
