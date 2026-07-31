import { describe, expect, it } from 'vitest';
import { MultiplayerSoakOrderedEvents } from '../../../scripts/multiplayerSoakOrderedEvents';

interface OrderedMessage {
  eventId: string;
  serverSequence: number;
}

function message(serverSequence: number): OrderedMessage {
  return {
    eventId: `event-${serverSequence}`,
    serverSequence,
  };
}

describe('MultiplayerSoakOrderedEvents', () => {
  it('buffers raw out-of-order delivery until the gap is filled', () => {
    const orderedEvents = new MultiplayerSoakOrderedEvents<OrderedMessage>();
    orderedEvents.establishCursor({ mode: 'baseline', sequence: 0 });

    expect(orderedEvents.receive(message(2))).toEqual({
      duplicate: false,
      ready: [],
    });
    expect(orderedEvents.getRequestedCursor()).toBe(0);
    expect(orderedEvents.receive(message(1))).toEqual({
      duplicate: false,
      ready: [message(1), message(2)],
    });
    expect(orderedEvents.getRequestedCursor()).toBe(2);
  });

  it('does not advance for an acknowledgement whose event is echoed', () => {
    const orderedEvents = new MultiplayerSoakOrderedEvents<OrderedMessage>();
    orderedEvents.establishCursor({ mode: 'baseline', sequence: 0 });

    expect(
      orderedEvents.acknowledge({
        serverSequence: 1,
        advancesCursor: false,
      }),
    ).toEqual([]);
    expect(orderedEvents.getRequestedCursor()).toBe(0);
    expect(orderedEvents.receive(message(1)).ready).toEqual([message(1)]);
    expect(orderedEvents.getRequestedCursor()).toBe(1);
  });

  it('uses an optimistic acknowledgement without skipping an earlier gap', () => {
    const orderedEvents = new MultiplayerSoakOrderedEvents<OrderedMessage>();
    orderedEvents.establishCursor({ mode: 'baseline', sequence: 0 });

    expect(orderedEvents.receive(message(3)).ready).toEqual([]);
    expect(
      orderedEvents.acknowledge({
        serverSequence: 2,
        advancesCursor: true,
      }),
    ).toEqual([]);
    expect(orderedEvents.getRequestedCursor()).toBe(0);
    expect(orderedEvents.receive(message(1)).ready).toEqual([
      message(1),
      message(3),
    ]);
    expect(orderedEvents.getRequestedCursor()).toBe(3);
  });

  it('accepts a lower journal baseline and identifies replay duplicates', () => {
    const orderedEvents = new MultiplayerSoakOrderedEvents<OrderedMessage>();
    orderedEvents.establishCursor({ mode: 'baseline', sequence: 99 });
    orderedEvents.establishCursor({ mode: 'baseline', sequence: 5 });

    expect(orderedEvents.getRequestedCursor()).toBe(5);
    expect(orderedEvents.isWithinRecoveryWindow(5)).toBe(false);
    expect(orderedEvents.isWithinRecoveryWindow(6)).toBe(true);
    expect(orderedEvents.receive(message(5))).toEqual({
      duplicate: true,
      ready: [],
    });
    expect(orderedEvents.hasReached(5)).toBe(true);
  });

  it('stops requiring events expired by a newer journal baseline', () => {
    const orderedEvents = new MultiplayerSoakOrderedEvents<OrderedMessage>();
    orderedEvents.establishCursor({ mode: 'baseline', sequence: 0 });
    expect(orderedEvents.receive(message(1)).ready).toEqual([message(1)]);

    orderedEvents.establishCursor({ mode: 'baseline', sequence: 100 });

    expect(orderedEvents.isWithinRecoveryWindow(99)).toBe(false);
    expect(orderedEvents.isWithinRecoveryWindow(100)).toBe(false);
    expect(orderedEvents.isWithinRecoveryWindow(101)).toBe(true);
  });
});
