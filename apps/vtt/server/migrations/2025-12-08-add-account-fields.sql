-- Add extended account fields for OAuth-backed application accounts
-- Safe to run multiple times (uses IF NOT EXISTS where possible)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "displayName" VARCHAR(255);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bio TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT TRUE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "lastLogin" TIMESTAMPTZ DEFAULT NOW();

-- Ensure displayName has a value for existing rows
UPDATE users
SET "displayName" = COALESCE("displayName", name)
WHERE "displayName" IS NULL;
