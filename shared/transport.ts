export interface TransportEnvelope {
  type: string;
  data: unknown;
  timestamp: number;
  src?: string;
  dst?: string;
  eventId?: string;
  actorId?: string;
  clientSequence?: number;
  serverSequence?: number;
  occurredAt?: number;
  roomCode?: string;
  echoToActor?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseTransportEnvelope(
  value: unknown,
  allowedTypes: ReadonlySet<string>,
): TransportEnvelope {
  if (!isRecord(value)) throw new TypeError('Message must be an object');
  if (typeof value.type !== 'string' || !allowedTypes.has(value.type)) {
    throw new TypeError('Message has an unsupported type');
  }
  if (!isRecord(value.data))
    throw new TypeError('Message data must be an object');
  if (
    typeof value.timestamp !== 'number' ||
    !Number.isFinite(value.timestamp)
  ) {
    throw new TypeError('Message timestamp must be a finite number');
  }
  if (value.src !== undefined && typeof value.src !== 'string') {
    throw new TypeError('Message src must be a string');
  }
  if (value.dst !== undefined && typeof value.dst !== 'string') {
    throw new TypeError('Message dst must be a string');
  }

  const orderingFields = [
    value.eventId,
    value.actorId,
    value.clientSequence,
    value.occurredAt,
  ];
  if (orderingFields.some((field) => field !== undefined)) {
    if (
      typeof value.eventId !== 'string' ||
      typeof value.actorId !== 'string' ||
      !Number.isSafeInteger(value.clientSequence) ||
      Number(value.clientSequence) < 0 ||
      typeof value.occurredAt !== 'number' ||
      !Number.isFinite(value.occurredAt)
    ) {
      throw new TypeError('Ordered event identity is invalid');
    }
  }
  if (
    value.serverSequence !== undefined &&
    (typeof value.serverSequence !== 'number' ||
      !Number.isSafeInteger(value.serverSequence) ||
      value.serverSequence <= 0)
  ) {
    throw new TypeError('Server sequence must be a positive safe integer');
  }
  if (value.roomCode !== undefined && typeof value.roomCode !== 'string') {
    throw new TypeError('Message roomCode must be a string');
  }
  if (
    value.echoToActor !== undefined &&
    typeof value.echoToActor !== 'boolean'
  ) {
    throw new TypeError('Message echoToActor must be a boolean');
  }

  if (value.type === 'event' && typeof value.data.name !== 'string') {
    throw new TypeError('Event messages require a name');
  }
  if (
    value.type === 'heartbeat' &&
    (typeof value.data.id !== 'string' ||
      !['ping', 'pong'].includes(String(value.data.type)))
  ) {
    throw new TypeError('Heartbeat message is invalid');
  }
  if (value.type === 'error' && typeof value.data.message !== 'string') {
    throw new TypeError('Error messages require a message');
  }
  if (
    value.type === 'update-confirmed' &&
    typeof value.data.updateId !== 'string'
  ) {
    throw new TypeError('Update confirmation requires an updateId');
  }
  if (
    value.type === 'game-state-patch' &&
    (!Array.isArray(value.data.patch) || typeof value.data.version !== 'number')
  ) {
    throw new TypeError('Game-state patch is invalid');
  }
  if (
    value.type === 'game-state-ack' &&
    (typeof value.data.token !== 'string' ||
      typeof value.data.version !== 'number')
  ) {
    throw new TypeError('Game-state acknowledgement is invalid');
  }
  if (
    value.type === 'game-state-resync-required' &&
    (typeof value.data.reason !== 'string' ||
      typeof value.data.serverToken !== 'string' ||
      typeof value.data.gameState !== 'object' ||
      value.data.gameState === null ||
      !Number.isSafeInteger(value.data.version) ||
      Number(value.data.version) < 0)
  ) {
    throw new TypeError('Game-state resync message is invalid');
  }
  if (
    value.type === 'event-ack' &&
    (typeof value.data.eventId !== 'string' ||
      !Number.isSafeInteger(value.data.serverSequence) ||
      Number(value.data.serverSequence) <= 0 ||
      typeof value.data.duplicate !== 'boolean' ||
      typeof value.data.advancesCursor !== 'boolean')
  ) {
    throw new TypeError('Event acknowledgement is invalid');
  }
  if (
    value.type === 'event-cursor' &&
    (!['baseline', 'resume'].includes(String(value.data.mode)) ||
      !Number.isSafeInteger(value.data.sequence) ||
      Number(value.data.sequence) < 0 ||
      !Number.isSafeInteger(value.data.replayThrough) ||
      Number(value.data.replayThrough) < Number(value.data.sequence))
  ) {
    throw new TypeError('Event cursor is invalid');
  }

  return value as unknown as TransportEnvelope;
}
