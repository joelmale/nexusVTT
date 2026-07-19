-- Persist all canonical game-state commit anchors together. Existing rows are
-- re-anchored lazily by the server because PostgreSQL does not reproduce the
-- application's canonical JSON SHA-256 function.
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS "stateVersion" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "syncToken" VARCHAR(64);

UPDATE sessions SET "gameState" = '{}'::jsonb WHERE "gameState" IS NULL;

ALTER TABLE sessions
  ALTER COLUMN "gameState" SET DEFAULT '{}'::jsonb,
  ALTER COLUMN "gameState" SET NOT NULL;
