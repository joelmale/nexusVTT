import type { PoolClient } from 'pg';
import type {
  ClientEventIdentity,
  EventReplayWindow,
  OrderedTransportEnvelope,
} from '../../shared/events/contracts.js';
import type { TransportEnvelope } from '../../shared/transport.js';
import { BaseRepository } from './base.js';

interface SessionSequenceRecord {
  id: string;
  eventSequence: string;
}

interface StoredEnvelopeRecord {
  envelope: OrderedTransportEnvelope;
}

interface DatabaseError {
  code?: string;
}

export interface AppendRoomEventResult {
  duplicate: boolean;
  event: OrderedTransportEnvelope;
}

const DEFAULT_MAX_EVENTS_PER_ROOM = 1_000;

function asSafeSequence(value: string | number): number {
  const sequence = Number(value);
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new Error(`Invalid room event sequence: ${String(value)}`);
  }
  return sequence;
}

export class EventJournalRepository extends BaseRepository {
  private readonly maxEventsPerRoom = Math.max(
    100,
    Number.parseInt(
      process.env.EVENT_JOURNAL_MAX_EVENTS ||
        String(DEFAULT_MAX_EVENTS_PER_ROOM),
      10,
    ) || DEFAULT_MAX_EVENTS_PER_ROOM,
  );

  async initialize(): Promise<void> {
    await this.pool.query(`
      ALTER TABLE sessions
      ADD COLUMN IF NOT EXISTS "eventSequence" BIGINT NOT NULL DEFAULT 0;

      CREATE TABLE IF NOT EXISTS room_events (
        "sessionId" UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        "serverSequence" BIGINT NOT NULL,
        "eventId" UUID NOT NULL,
        "actorId" UUID NOT NULL,
        "clientSequence" BIGINT NOT NULL,
        envelope JSONB NOT NULL,
        "occurredAt" TIMESTAMPTZ NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY ("sessionId", "serverSequence"),
        UNIQUE ("sessionId", "eventId")
      );

      CREATE INDEX IF NOT EXISTS idx_room_events_replay
      ON room_events ("sessionId", "serverSequence");

      CREATE INDEX IF NOT EXISTS idx_room_events_created_at
      ON room_events ("createdAt");
    `);
  }

  async append(
    roomCode: string,
    identity: ClientEventIdentity,
    message: TransportEnvelope,
  ): Promise<AppendRoomEventResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const duplicate = await this.findByEventId(
        client,
        roomCode,
        identity.eventId,
      );
      if (duplicate) {
        await client.query('COMMIT');
        return { duplicate: true, event: duplicate };
      }

      const sequenceResult = await client.query<SessionSequenceRecord>(
        `UPDATE sessions
         SET "eventSequence" = "eventSequence" + 1, "lastActivity" = NOW()
         WHERE "joinCode" = $1
         RETURNING id, "eventSequence"`,
        [roomCode],
      );
      const session = sequenceResult.rows[0];
      if (!session) {
        throw new Error(`Cannot append an event for unknown room ${roomCode}`);
      }

      const serverSequence = asSafeSequence(session.eventSequence);
      const event: OrderedTransportEnvelope = {
        ...message,
        ...identity,
        roomCode,
        serverSequence,
      };

      await client.query(
        `INSERT INTO room_events (
           "sessionId", "serverSequence", "eventId", "actorId",
           "clientSequence", envelope, "occurredAt"
         ) VALUES (
           $1, $2, $3, $4, $5, $6::jsonb,
           to_timestamp($7::double precision / 1000.0)
         )`,
        [
          session.id,
          serverSequence,
          identity.eventId,
          identity.actorId,
          identity.clientSequence,
          JSON.stringify(event),
          identity.occurredAt,
        ],
      );

      await client.query(
        `DELETE FROM room_events
         WHERE "sessionId" = $1
           AND "serverSequence" <= $2::bigint - $3::bigint`,
        [session.id, serverSequence, this.maxEventsPerRoom],
      );

      await client.query('COMMIT');
      return { duplicate: false, event };
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as DatabaseError).code === '23505') {
        const duplicate = await this.find(roomCode, identity.eventId);
        if (duplicate) return { duplicate: true, event: duplicate };
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async getReplayWindow(
    roomCode: string,
    afterSequence: number | null,
  ): Promise<EventReplayWindow> {
    const sessionResult = await this.pool.query<SessionSequenceRecord>(
      `SELECT id, "eventSequence"
       FROM sessions
       WHERE "joinCode" = $1`,
      [roomCode],
    );
    const session = sessionResult.rows[0];
    if (!session) {
      throw new Error(`Cannot replay events for unknown room ${roomCode}`);
    }

    const latestSequence = asSafeSequence(session.eventSequence);
    if (afterSequence === null) {
      return {
        baselineSequence: latestSequence,
        latestSequence,
        events: [],
        truncated: false,
      };
    }

    if (afterSequence > latestSequence) {
      return {
        baselineSequence: latestSequence,
        latestSequence,
        events: [],
        truncated: true,
      };
    }

    const boundsResult = await this.pool.query<{
      earliestSequence: string | null;
    }>(
      `SELECT MIN("serverSequence") AS "earliestSequence"
       FROM room_events
       WHERE "sessionId" = $1`,
      [session.id],
    );
    const earliestValue = boundsResult.rows[0]?.earliestSequence;
    if (earliestValue === null || earliestValue === undefined) {
      return {
        baselineSequence: latestSequence,
        latestSequence,
        events: [],
        truncated: afterSequence < latestSequence,
      };
    }

    const earliestSequence = asSafeSequence(earliestValue);
    const truncated = afterSequence < earliestSequence - 1;
    const baselineSequence = truncated
      ? earliestSequence - 1
      : Math.min(afterSequence, latestSequence);
    const eventsResult = await this.pool.query<StoredEnvelopeRecord>(
      `SELECT envelope
       FROM room_events
       WHERE "sessionId" = $1
         AND "serverSequence" > $2
         AND "serverSequence" <= $3
       ORDER BY "serverSequence" ASC`,
      [session.id, baselineSequence, latestSequence],
    );

    return {
      baselineSequence,
      latestSequence,
      events: eventsResult.rows.map((row) => row.envelope),
      truncated,
    };
  }

  async find(
    roomCode: string,
    eventId: string,
  ): Promise<OrderedTransportEnvelope | null> {
    const result = await this.pool.query<StoredEnvelopeRecord>(
      `SELECT event.envelope
       FROM room_events event
       INNER JOIN sessions session ON session.id = event."sessionId"
       WHERE session."joinCode" = $1 AND event."eventId" = $2`,
      [roomCode, eventId],
    );
    return result.rows[0]?.envelope || null;
  }

  private async findByEventId(
    client: PoolClient,
    roomCode: string,
    eventId: string,
  ): Promise<OrderedTransportEnvelope | null> {
    const result = await client.query<StoredEnvelopeRecord>(
      `SELECT event.envelope
       FROM room_events event
       INNER JOIN sessions session ON session.id = event."sessionId"
       WHERE session."joinCode" = $1 AND event."eventId" = $2`,
      [roomCode, eventId],
    );
    return result.rows[0]?.envelope || null;
  }
}
