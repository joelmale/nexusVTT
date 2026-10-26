-- Keep creation replay identity independently of browser cache or room state.
CREATE TABLE IF NOT EXISTS character_creation_attempts (
    "ownerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "attemptId" VARCHAR(128) NOT NULL,
    "payloadHash" VARCHAR(64) NOT NULL,
    "characterId" UUID REFERENCES characters(id) ON DELETE SET NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("ownerId", "attemptId")
);
