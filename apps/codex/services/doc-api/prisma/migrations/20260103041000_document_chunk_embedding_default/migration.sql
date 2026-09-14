-- Ensure existing rows have an empty embedding instead of NULL
UPDATE "document_chunks"
SET "embedding" = '{}'
WHERE "embedding" IS NULL;

-- Enforce non-null with default empty array
ALTER TABLE "document_chunks"
ALTER COLUMN "embedding" SET DEFAULT '{}',
ALTER COLUMN "embedding" SET NOT NULL;
