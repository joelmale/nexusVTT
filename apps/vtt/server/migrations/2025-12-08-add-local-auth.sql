-- Add columns to support local email/password accounts

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "passwordSalt" TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "passwordIterations" INTEGER DEFAULT 120000;

-- Ensure existing rows have a default iteration count for future hashes
UPDATE users
SET "passwordIterations" = COALESCE("passwordIterations", 120000)
WHERE "passwordIterations" IS NULL;
