export interface TransportEnvelope {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
  src?: string;
  dst?: string;
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
    typeof value.data.reason !== 'string'
  ) {
    throw new TypeError('Game-state resync message is invalid');
  }

  return value as unknown as TransportEnvelope;
}
