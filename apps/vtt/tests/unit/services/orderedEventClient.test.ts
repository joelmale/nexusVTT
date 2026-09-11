import { beforeEach, describe, expect, it } from 'vitest';
import { OrderedEventClient } from '@/services/orderedEventClient';
import type { OrderedTransportEnvelope } from '../../../shared/events/contracts';
import type { TransportEnvelope } from '../../../shared/transport';

function orderedMessage(sequence: number): OrderedTransportEnvelope {
  return {
    type: 'event',
    data: { name: 'scene/update', sceneId: 'scene-1' },
    timestamp: sequence,
    eventId: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    actorId: 'actor-1',
    clientSequence: sequence,
    serverSequence: sequence,
    occurredAt: sequence,
    roomCode: 'ABCD',
  };
}

describe('OrderedEventClient', () => {
  beforeEach(() => localStorage.clear());

  it('buffers an out-of-order event until the missing sequence arrives', () => {
    const client = new OrderedEventClient();
    client.configure('ABCD', 'user-1');
    client.establishCursor({
      mode: 'baseline',
      sequence: 0,
      replayThrough: 0,
    });

    expect(client.receive(orderedMessage(2))).toEqual([]);
    expect(client.receive(orderedMessage(1))).toEqual([
      orderedMessage(1),
      orderedMessage(2),
    ]);
    expect(client.getRequestedCursor()).toBe(2);
  });

  it('uses an acknowledgement as the sequence marker for an optimistic event', () => {
    const client = new OrderedEventClient();
    client.configure('ABCD', 'user-1');
    client.establishCursor({
      mode: 'baseline',
      sequence: 0,
      replayThrough: 0,
    });

    expect(client.receive(orderedMessage(2))).toEqual([]);
    expect(
      client.acknowledge({
        eventId: crypto.randomUUID(),
        serverSequence: 1,
        duplicate: false,
        advancesCursor: true,
      }),
    ).toEqual([orderedMessage(2)]);
    expect(client.getRequestedCursor()).toBe(2);
  });

  it('persists pending identities for retry and removes them after an ack', () => {
    const first = new OrderedEventClient();
    first.configure('ABCD', 'user-1');
    const identity = first.createIdentity();
    const message: TransportEnvelope = {
      type: 'chat-message',
      data: { id: 'chat-1', content: 'hello' },
      timestamp: identity.occurredAt,
      src: 'user-1',
      ...identity,
    };
    first.track(message);

    const recovered = new OrderedEventClient();
    recovered.configure('ABCD', 'user-1');
    expect(recovered.pendingMessages()).toEqual([message]);

    recovered.acknowledge({
      eventId: identity.eventId,
      serverSequence: 1,
      duplicate: true,
      advancesCursor: false,
    });
    expect(recovered.pendingMessages()).toEqual([]);
  });

  it('accepts a lower server baseline after journal recovery', () => {
    localStorage.setItem('nexus-event-cursor:ABCD:user-1', '99');
    const client = new OrderedEventClient();
    client.configure('ABCD', 'user-1');

    client.establishCursor({
      mode: 'baseline',
      sequence: 5,
      replayThrough: 5,
    });

    expect(client.getRequestedCursor()).toBe(5);
  });
});
