import type { TransportEnvelope } from '../transport';

export interface ClientEventIdentity {
  eventId: string;
  actorId: string;
  clientSequence: number;
  occurredAt: number;
}

export interface OrderedEventMetadata extends ClientEventIdentity {
  roomCode: string;
  serverSequence: number;
  echoToActor: boolean;
}

export type OrderedTransportEnvelope = TransportEnvelope & OrderedEventMetadata;

interface EventMetadataCandidate {
  eventId?: unknown;
  actorId?: unknown;
  clientSequence?: unknown;
  serverSequence?: unknown;
  occurredAt?: unknown;
  roomCode?: unknown;
  echoToActor?: unknown;
}

export interface EventAcknowledgement {
  eventId: string;
  serverSequence: number;
  duplicate: boolean;
  advancesCursor: boolean;
}

export interface EventCursorUpdate {
  mode: 'baseline' | 'resume';
  sequence: number;
  replayThrough: number;
}

export interface EventReplayWindow {
  baselineSequence: number;
  latestSequence: number;
  events: OrderedTransportEnvelope[];
  truncated: boolean;
}

const DURABLE_EVENT_NAMES = new Set([
  'character/create',
  'character/delete',
  'character/roll',
  'character/sync',
  'character/update',
  'dice/roll-request',
  'dice/roll-result',
  'drawing/clear',
  'drawing/create',
  'drawing/delete',
  'drawing/update',
  'fog/clear',
  'fog/update',
  'prop/delete',
  'prop/interact',
  'prop/move',
  'prop/place',
  'prop/update',
  'scene/change',
  'scene/create',
  'scene/delete',
  'scene/reorder',
  'scene/update',
  'token/add-custom',
  'token/delete',
  'token/move',
  'token/place',
  'token/update',
]);

/**
 * Durable events affect shared room history and must be sequenced. Presence,
 * cursor, typing, heartbeat, and canonical snapshot traffic intentionally stay
 * outside the journal because they are either transient or have their own
 * integrity protocol.
 */
export function isDurableTransportEvent(type: string, data: unknown): boolean {
  if (type === 'chat-message') return true;
  return (
    type === 'event' &&
    typeof data === 'object' &&
    data !== null &&
    'name' in data &&
    DURABLE_EVENT_NAMES.has(String(data.name))
  );
}

export function hasClientEventIdentity(
  value: EventMetadataCandidate,
): value is EventMetadataCandidate & ClientEventIdentity {
  return (
    typeof value.eventId === 'string' &&
    typeof value.actorId === 'string' &&
    Number.isSafeInteger(value.clientSequence) &&
    Number(value.clientSequence) >= 0 &&
    typeof value.occurredAt === 'number' &&
    Number.isFinite(value.occurredAt)
  );
}

export function hasOrderedEventMetadata(
  value: EventMetadataCandidate,
): value is EventMetadataCandidate & OrderedTransportEnvelope {
  return (
    hasClientEventIdentity(value) &&
    typeof value.roomCode === 'string' &&
    typeof value.echoToActor === 'boolean' &&
    typeof value.serverSequence === 'number' &&
    Number.isSafeInteger(value.serverSequence) &&
    value.serverSequence > 0
  );
}
