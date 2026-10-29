-- Co-DMs who may edit and publish a campaign's prep. The owner stays
-- campaigns."dmId" and has no row here, so ownership has one source of truth.
CREATE TABLE IF NOT EXISTS campaign_members (
    "campaignId" UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('co-dm')),
    "invitedBy" UUID REFERENCES users(id) ON DELETE SET NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("campaignId", "userId")
);

CREATE INDEX IF NOT EXISTS idx_campaign_members_userId ON campaign_members("userId");
