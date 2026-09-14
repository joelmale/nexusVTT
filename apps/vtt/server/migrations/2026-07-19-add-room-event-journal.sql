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
ON room_events("sessionId", "serverSequence");

CREATE INDEX IF NOT EXISTS idx_room_events_created_at
ON room_events("createdAt");
