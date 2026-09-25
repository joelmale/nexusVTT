-- Add Session Plan Activations for linking published session plans into live VTT sessions.

CREATE TABLE IF NOT EXISTS session_plan_activations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "campaignId" UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    "sessionPlanId" UUID NOT NULL REFERENCES campaign_objects(id) ON DELETE CASCADE,
    "planRevision" INTEGER NOT NULL CHECK ("planRevision" >= 1),
    "sessionId" VARCHAR(64) NOT NULL,
    "currentStepIndex" INTEGER NOT NULL DEFAULT 0 CHECK ("currentStepIndex" >= 0),
    status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
    "stepStates" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "activatedBy" UUID REFERENCES users(id) ON DELETE SET NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_plan_activations_campaign
    ON session_plan_activations("campaignId");
CREATE INDEX IF NOT EXISTS idx_session_plan_activations_session_plan
    ON session_plan_activations("sessionPlanId");
CREATE INDEX IF NOT EXISTS idx_session_plan_activations_session
    ON session_plan_activations("sessionId");
CREATE INDEX IF NOT EXISTS idx_session_plan_activations_status
    ON session_plan_activations("status");

DROP TRIGGER IF EXISTS update_session_plan_activations_updated_at ON session_plan_activations;
CREATE TRIGGER update_session_plan_activations_updated_at
    BEFORE UPDATE ON session_plan_activations
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
