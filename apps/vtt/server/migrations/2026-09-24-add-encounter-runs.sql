-- Migration: Add encounter_runs table for live combat execution
-- Created: 2026-09-24

CREATE TABLE IF NOT EXISTS encounter_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "campaignId" UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    "templateRef" JSONB NOT NULL,
    stage VARCHAR(32) NOT NULL DEFAULT 'staged',
    "deploymentCommandId" UUID NOT NULL,
    "activeSessionId" UUID,
    "currentRound" INTEGER NOT NULL DEFAULT 1,
    "currentTurnIndex" INTEGER NOT NULL DEFAULT 0,
    "activeWaveIndex" INTEGER NOT NULL DEFAULT 0,
    participants JSONB NOT NULL DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_encounter_runs_campaign ON encounter_runs("campaignId");
CREATE INDEX IF NOT EXISTS idx_encounter_runs_stage ON encounter_runs(stage);

DROP TRIGGER IF EXISTS update_encounter_runs_updated_at ON encounter_runs;
CREATE TRIGGER update_encounter_runs_updated_at 
    BEFORE UPDATE ON encounter_runs 
    FOR EACH ROW 
    EXECUTE PROCEDURE update_updated_at_column();
