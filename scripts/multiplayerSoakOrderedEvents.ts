export interface SoakOrderedMessage {
  serverSequence: number;
}

export interface SoakEventCursorUpdate {
  mode: 'baseline' | 'resume';
  sequence: number;
}

export interface SoakEventAcknowledgement {
  serverSequence: number;
  advancesCursor: boolean;
}

export interface SoakOrderedReceiveResult<T> {
  duplicate: boolean;
  ready: T[];
}

/**
 * Mirrors the browser ordered-event cursor without its localStorage outbox.
 * Raw WebSocket delivery may interleave live fanout with journal replay, so the
 * reconnect cursor only advances through a contiguous sequence.
 */
export class MultiplayerSoakOrderedEvents<T extends SoakOrderedMessage> {
  private lastSeenSequence: number | null = null;
  private readonly buffered = new Map<number, T>();
  private readonly acknowledgedSequences = new Set<number>();

  public getRequestedCursor(): number | null {
    return this.lastSeenSequence;
  }

  public hasReached(sequence: number): boolean {
    return this.lastSeenSequence !== null && this.lastSeenSequence >= sequence;
  }

  public establishCursor(update: SoakEventCursorUpdate): T[] {
    this.assertSequence(update.sequence);
    if (update.mode === 'baseline') {
      this.lastSeenSequence = update.sequence;
      for (const sequence of this.buffered.keys()) {
        if (sequence <= update.sequence) this.buffered.delete(sequence);
      }
      for (const sequence of this.acknowledgedSequences) {
        if (sequence <= update.sequence) {
          this.acknowledgedSequences.delete(sequence);
        }
      }
    } else if (
      this.lastSeenSequence === null ||
      update.sequence > this.lastSeenSequence
    ) {
      this.lastSeenSequence = update.sequence;
    }
    return this.drain();
  }

  public receive(message: T): SoakOrderedReceiveResult<T> {
    this.assertSequence(message.serverSequence);
    const lastSeen = this.lastSeenSequence ?? 0;
    if (message.serverSequence <= lastSeen) {
      return { duplicate: true, ready: [] };
    }

    const duplicate = this.buffered.has(message.serverSequence);
    if (!duplicate) {
      this.buffered.set(message.serverSequence, message);
    }
    return { duplicate, ready: this.drain() };
  }

  public acknowledge(acknowledgement: SoakEventAcknowledgement): T[] {
    this.assertSequence(acknowledgement.serverSequence);
    if (acknowledgement.advancesCursor) {
      this.acknowledgedSequences.add(acknowledgement.serverSequence);
    }
    return this.drain();
  }

  private drain(): T[] {
    const ready: T[] = [];
    let next = (this.lastSeenSequence ?? 0) + 1;
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
    return ready;
  }

  private assertSequence(sequence: number): void {
    if (!Number.isSafeInteger(sequence) || sequence < 0) {
      throw new Error(`Invalid ordered-event sequence: ${sequence}`);
    }
  }
}
