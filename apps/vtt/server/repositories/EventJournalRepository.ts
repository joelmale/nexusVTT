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

export interface EntityVersionPrecondition {
  entityId: string;
  expectedVersion: number;
}

export class EntityVersionConflictError extends Error {
  constructor(
    public readonly entityId: string,
    public readonly expectedVersion: number,
    public readonly currentVersion: number,
  ) {
    super(
      `Entity ${entityId} expected version ${expectedVersion}, current version ${currentVersion}`,
    );
    this.name = 'EntityVersionConflictError';
  }
}

const DEFAULT_MAX_EVENTS_PER_ROOM = 1_000;

function asSafeSequence(value: string | number): number {
  const sequence = Number(value);
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new Error(`Invalid room event sequence: ${String(value)}`);
  }
  return sequence;
}

function withDeliveryPolicy(
  envelope: OrderedTransportEnvelope,
): OrderedTransportEnvelope {
  const candidate = envelope as OrderedTransportEnvelope & {
    echoToActor?: boolean;
  };
  if (typeof candidate.echoToActor === 'boolean') return envelope;
  const eventName =
    candidate.type === 'event' &&
    typeof candidate.data === 'object' &&
    candidate.data !== null &&
    'name' in candidate.data
      ? String(candidate.data.name)
      : null;
  return {
    ...candidate,
    // Compatibility for journal rows written before delivery policy became
    // explicit. Chat and authoritative dice were the only sender echoes.
    echoToActor:
      candidate.type === 'chat-message' || eventName === 'dice/roll-result',
  };
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

      CREATE TABLE IF NOT EXISTS room_entity_versions (
        "sessionId" UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        "entityId" TEXT NOT NULL,
        version BIGINT NOT NULL,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY ("sessionId", "entityId")
      );
    `);
  }

  async append(
    roomCode: string,
    identity: ClientEventIdentity,
    message: TransportEnvelope,
    echoToActor: boolean,
    entityVersion?: EntityVersionPrecondition,
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
      if (entityVersion) {
        const versionResult = await client.query<{ version: string }>(
          `INSERT INTO room_entity_versions (
             "sessionId", "entityId", version, "updatedAt"
           ) VALUES ($1, $2, $3::bigint + 1, NOW())
           ON CONFLICT ("sessionId", "entityId") DO UPDATE
           SET version = $3::bigint + 1, "updatedAt" = NOW()
           WHERE room_entity_versions.version <= $3::bigint
           RETURNING version`,
          [session.id, entityVersion.entityId, entityVersion.expectedVersion],
        );
        if (!versionResult.rows[0]) {
          const currentResult = await client.query<{ version: string }>(
            `SELECT version
             FROM room_entity_versions
             WHERE "sessionId" = $1 AND "entityId" = $2`,
            [session.id, entityVersion.entityId],
          );
          throw new EntityVersionConflictError(
            entityVersion.entityId,
            entityVersion.expectedVersion,
            asSafeSequence(currentResult.rows[0]?.version ?? 0),
          );
        }
      }
      const event: OrderedTransportEnvelope = {
        ...message,
        ...identity,
        roomCode,
        serverSequence,
        echoToActor,
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
      events: eventsResult.rows.map((row) => withDeliveryPolicy(row.envelope)),
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
    const envelope = result.rows[0]?.envelope;
    return envelope ? withDeliveryPolicy(envelope) : null;
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
    const envelope = result.rows[0]?.envelope;
    return envelope ? withDeliveryPolicy(envelope) : null;
  }
}
