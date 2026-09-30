-- Harden session plan activations so publish -> activate -> run sheet is
-- durable and safe to retry.
--
-- * "requestId" is the activation command ID. Replaying the same request
--   returns the original activation instead of restarting the run.
-- * revision is the activation's own compare-and-swap counter. Progress
--   writes must name the revision they observed.
-- * "completedAt" is written by the progress endpoint when a run completes
--   (the column was referenced before it existed).
-- * At most one active activation may exist per campaign session, so two
--   concurrent activations cannot both be "the" run sheet.

ALTER TABLE session_plan_activations
    ADD COLUMN IF NOT EXISTS "requestId" UUID,
    ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'session_plan_activations_revision_check'
    ) THEN
        ALTER TABLE session_plan_activations
            ADD CONSTRAINT session_plan_activations_revision_check
            CHECK (revision >= 1);
    END IF;
END $$;

-- Rows written before this migration could, under a race, leave more than one
-- active activation for a session. Keep the newest and complete the rest so
-- the unique index below can be created.
UPDATE session_plan_activations older
SET status = 'completed',
    "completedAt" = COALESCE(older."completedAt", NOW())
WHERE older.status = 'active'
  AND EXISTS (
      SELECT 1 FROM session_plan_activations newer
      WHERE newer."campaignId" = older."campaignId"
        AND newer."sessionId" = older."sessionId"
        AND newer.status = 'active'
        AND (newer."createdAt", newer.id) > (older."createdAt", older.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_session_plan_activations_active_session
    ON session_plan_activations("campaignId", "sessionId")
    WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS uq_session_plan_activations_request
    ON session_plan_activations("campaignId", "requestId")
    WHERE "requestId" IS NOT NULL;
