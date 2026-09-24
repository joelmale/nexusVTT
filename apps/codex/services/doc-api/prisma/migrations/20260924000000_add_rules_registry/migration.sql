-- Rules registry (Phase 4 of the private admin control plane).
--
-- Additive only. Every statement is guarded so the migration is safe to apply
-- to a database that was originally created with `prisma db push` and later
-- baselined, and safe to re-run by hand after a partial failure.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "RulesEntityType" AS ENUM ('spell', 'item', 'monster');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "RulesRevisionStatus" AS ENUM ('draft', 'validated', 'published', 'superseded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "rules_entities" (
    "id" TEXT NOT NULL,
    "entityType" "RulesEntityType" NOT NULL,
    "slug" TEXT NOT NULL,
    "ruleset" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "headRevisionNumber" INTEGER NOT NULL DEFAULT 0,
    "currentPublishedRevisionId" TEXT,
    "catalogVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "rules_entities_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "rules_entities_ruleset_check" CHECK ("ruleset" IN ('2014', '2024')),
    CONSTRAINT "rules_entities_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "rules_entity_revisions" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "status" "RulesRevisionStatus" NOT NULL DEFAULT 'draft',
    "schemaVersion" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "sourceDocumentId" TEXT,
    "sourceLicense" TEXT NOT NULL,
    "restoredFromRevisionNumber" INTEGER,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedBy" TEXT,
    "validatedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "catalogVersion" INTEGER,
    "supersededAt" TIMESTAMP(3),

    CONSTRAINT "rules_entity_revisions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "rules_entity_revisions_published_check" CHECK (
      "status" NOT IN ('published') OR ("publishedAt" IS NOT NULL AND "publishedBy" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "rules_catalog_versions" (
    "version" INTEGER NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedBy" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changedEntityIds" TEXT[],

    CONSTRAINT "rules_catalog_versions_pkey" PRIMARY KEY ("version"),
    CONSTRAINT "rules_catalog_versions_version_check" CHECK ("version" > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "rules_entities_currentPublishedRevisionId_key" ON "rules_entities"("currentPublishedRevisionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rules_entities_ruleset_entityType_idx" ON "rules_entities"("ruleset", "entityType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rules_entities_catalogVersion_idx" ON "rules_entities"("catalogVersion");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "rules_entities_entityType_ruleset_slug_key" ON "rules_entities"("entityType", "ruleset", "slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rules_entity_revisions_status_idx" ON "rules_entity_revisions"("status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "rules_entity_revisions_entityId_revisionNumber_key" ON "rules_entity_revisions"("entityId", "revisionNumber");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "rules_entities" ADD CONSTRAINT "rules_entities_currentPublishedRevisionId_fkey" FOREIGN KEY ("currentPublishedRevisionId") REFERENCES "rules_entity_revisions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "rules_entity_revisions" ADD CONSTRAINT "rules_entity_revisions_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "rules_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Revision immutability (control-plane invariant 9).
--
-- Revision content is write-once: only lifecycle columns may change, along
-- the transitions draft -> validated -> published -> superseded (and
-- draft/validated -> superseded when a newer draft replaces them). A revision
-- that has ever been published can never be deleted. The application enforces
-- the same rules; this trigger is the defence in depth.
CREATE OR REPLACE FUNCTION "rules_entity_revisions_guard"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."publishedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'published rules revision % cannot be deleted', OLD."id"
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF (NEW."id", NEW."entityId", NEW."revisionNumber", NEW."schemaVersion", NEW."data",
      NEW."sourceDocumentId", NEW."sourceLicense", NEW."restoredFromRevisionNumber",
      NEW."createdBy", NEW."createdAt")
     IS DISTINCT FROM
     (OLD."id", OLD."entityId", OLD."revisionNumber", OLD."schemaVersion", OLD."data",
      OLD."sourceDocumentId", OLD."sourceLicense", OLD."restoredFromRevisionNumber",
      OLD."createdBy", OLD."createdAt") THEN
    RAISE EXCEPTION 'rules revision % content is immutable', OLD."id"
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD."publishedAt" IS NOT NULL AND
     (NEW."publishedAt", NEW."publishedBy", NEW."catalogVersion", NEW."validatedAt", NEW."validatedBy")
     IS DISTINCT FROM
     (OLD."publishedAt", OLD."publishedBy", OLD."catalogVersion", OLD."validatedAt", OLD."validatedBy") THEN
    RAISE EXCEPTION 'published rules revision % is immutable', OLD."id"
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW."status" IS DISTINCT FROM OLD."status" AND NOT (
       (OLD."status" = 'draft' AND NEW."status" IN ('validated', 'superseded')) OR
       (OLD."status" = 'validated' AND NEW."status" IN ('published', 'superseded')) OR
       (OLD."status" = 'published' AND NEW."status" = 'superseded')
     ) THEN
    RAISE EXCEPTION 'illegal rules revision transition % -> %', OLD."status", NEW."status"
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD."status" = 'superseded' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'superseded rules revision % is immutable', OLD."id"
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "rules_entity_revisions_guard" ON "rules_entity_revisions";
CREATE TRIGGER "rules_entity_revisions_guard"
  BEFORE UPDATE OR DELETE ON "rules_entity_revisions"
  FOR EACH ROW EXECUTE FUNCTION "rules_entity_revisions_guard"();

-- The catalog version log is append-only.
CREATE OR REPLACE FUNCTION "rules_catalog_versions_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'rules_catalog_versions is append-only'
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "rules_catalog_versions_append_only" ON "rules_catalog_versions";
CREATE TRIGGER "rules_catalog_versions_append_only"
  BEFORE UPDATE OR DELETE ON "rules_catalog_versions"
  FOR EACH ROW EXECUTE FUNCTION "rules_catalog_versions_append_only"();
