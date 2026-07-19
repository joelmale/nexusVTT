import { v4 as uuidv4 } from 'uuid';
import type {
  ClientEventIdentity,
  EventAcknowledgement,
  EventCursorUpdate,
  OrderedTransportEnvelope,
} from '../../shared/events/contracts';
import type { TransportEnvelope } from '../../shared/transport';

const MAX_PENDING_EVENTS = 100;

interface OrderedEventContext {
  roomCode: string;
  userId: string;
}

function readNumber(key: string): number | null {
  try {
    const value = localStorage.getItem(key);
    if (value === null) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Maintains the browser's durable outbox and ordered receive cursor. Messages
 * above a sequence gap wait in memory until replay supplies the missing event;
 * acknowledgements advance gaps for optimistic events that are not echoed to
 * their sender.
 */
export class OrderedEventClient {
  private context: OrderedEventContext | null = null;
  private clientSequence = 0;
  private lastSeenSequence: number | null = null;
  private pending = new Map<string, TransportEnvelope>();
  private buffered = new Map<number, OrderedTransportEnvelope>();
  private acknowledgedSequences = new Set<number>();

  configure(roomCode: string, userId: string): void {
    const next = { roomCode: roomCode.toUpperCase(), userId };
    if (
      this.context?.roomCode === next.roomCode &&
      this.context.userId === next.userId
    ) {
      return;
    }

    this.context = next;
    this.clientSequence = readNumber(this.sequenceKey()) || 0;
    this.lastSeenSequence = readNumber(this.cursorKey());
    this.pending = new Map(
      this.readPending().map((message) => [message.eventId || '', message]),
    );
    this.pending.delete('');
    this.buffered.clear();
    this.acknowledgedSequences.clear();
  }

  reset(): void {
    this.context = null;
    this.clientSequence = 0;
    this.lastSeenSequence = null;
    this.pending.clear();
    this.buffered.clear();
    this.acknowledgedSequences.clear();
  }

  getRequestedCursor(): number | null {
    return this.lastSeenSequence;
  }

  createIdentity(): ClientEventIdentity {
    if (!this.context) {
      throw new Error('Ordered event context is not configured');
    }
    this.clientSequence += 1;
    this.writeNumber(this.sequenceKey(), this.clientSequence);
    return {
      eventId: uuidv4(),
      actorId: this.context.userId,
      clientSequence: this.clientSequence,
      occurredAt: Date.now(),
    };
  }

  track(message: TransportEnvelope): void {
    if (!message.eventId) return;
    this.pending.set(message.eventId, message);
    while (this.pending.size > MAX_PENDING_EVENTS) {
      const oldest = this.pending.keys().next().value as string | undefined;
      if (!oldest) break;
      this.pending.delete(oldest);
    }
    this.persistPending();
  }

  pendingMessages(): TransportEnvelope[] {
    return Array.from(this.pending.values());
  }

  acknowledge(data: EventAcknowledgement): OrderedTransportEnvelope[] {
    this.pending.delete(data.eventId);
    this.persistPending();
    if (data.advancesCursor) {
      this.acknowledgedSequences.add(data.serverSequence);
    }
    return this.drain();
  }

  establishCursor(data: EventCursorUpdate): OrderedTransportEnvelope[] {
    if (data.mode === 'baseline') {
      this.lastSeenSequence = data.sequence;
      for (const sequence of this.buffered.keys()) {
        if (sequence <= data.sequence) this.buffered.delete(sequence);
      }
      for (const sequence of this.acknowledgedSequences) {
        if (sequence <= data.sequence) {
          this.acknowledgedSequences.delete(sequence);
        }
      }
    } else if (
      this.lastSeenSequence === null ||
      data.sequence > this.lastSeenSequence
    ) {
      this.lastSeenSequence = data.sequence;
    }
    this.persistCursor();
    return this.drain();
  }

  receive(message: OrderedTransportEnvelope): OrderedTransportEnvelope[] {
    const lastSeen = this.lastSeenSequence || 0;
    if (message.serverSequence <= lastSeen) return [];
    this.buffered.set(message.serverSequence, message);
    return this.drain();
  }

  private drain(): OrderedTransportEnvelope[] {
    const ready: OrderedTransportEnvelope[] = [];
    let next = (this.lastSeenSequence || 0) + 1;
    while (this.acknowledgedSequences.has(next) || this.buffered.has(next)) {
      if (this.acknowledgedSequences.delete(next)) {
        this.buffered.delete(next);
      } else {
        const message = this.buffered.get(next);
        if (message) ready.push(message);
        this.buffered.delete(next);
      }
      this.lastSeenSequence = next;
      next += 1;
    }
    this.persistCursor();
    return ready;
  }

  private cursorKey(): string {
    return `nexus-event-cursor:${this.context?.roomCode || 'none'}:${this.context?.userId || 'none'}`;
  }

  private sequenceKey(): string {
    return `nexus-client-event-sequence:${this.context?.userId || 'none'}`;
  }

  private pendingKey(): string {
    return `nexus-event-outbox:${this.context?.roomCode || 'none'}:${this.context?.userId || 'none'}`;
  }

  private persistCursor(): void {
    if (this.lastSeenSequence === null) return;
    this.writeNumber(this.cursorKey(), this.lastSeenSequence);
  }

  private persistPending(): void {
    if (!this.context) return;
    try {
      localStorage.setItem(
        this.pendingKey(),
        JSON.stringify(Array.from(this.pending.values())),
      );
    } catch (error) {
      console.warn('Failed to persist ordered event outbox:', error);
    }
  }

  private readPending(): TransportEnvelope[] {
    if (!this.context) return [];
    try {
      const value = localStorage.getItem(this.pendingKey());
      if (!value) return [];
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter(
            (message): message is TransportEnvelope =>
              typeof message === 'object' && message !== null,
          )
        : [];
    } catch {
      return [];
    }
  }

  private writeNumber(key: string, value: number): void {
    try {
      localStorage.setItem(key, String(value));
    } catch (error) {
      console.warn('Failed to persist ordered event sequence:', error);
    }
  }
}

export const orderedEventClient = new OrderedEventClient();
