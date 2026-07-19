CREATE TABLE IF NOT EXISTS room_entity_versions (
    "sessionId" UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    "entityId" TEXT NOT NULL,
    version BIGINT NOT NULL,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("sessionId", "entityId")
);
