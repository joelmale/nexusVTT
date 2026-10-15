-- Postgres full-text search (replaces Elasticsearch for document search) and a
-- log_events table (replaces the Elasticsearch nexus-logs index).
--
-- Search is spread over three sources so no single tsvector grows past
-- Postgres's 1 MB limit: document metadata (title/description/tags),
-- document_chunks (extracted text, ~1500 chars each) and structured_data
-- (SRD entries). Triggers keep the vectors current whatever service writes.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Document metadata: title (A), description (B), tags (B).
ALTER TABLE "documents" ADD COLUMN "searchVector" tsvector;

CREATE OR REPLACE FUNCTION documents_compute_search_vector(
  doc_title text, doc_description text, doc_tags text[]
) RETURNS tsvector AS $$
  SELECT
    setweight(to_tsvector('english', coalesce(doc_title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(doc_description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(doc_tags, ' '), '')), 'B')
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION documents_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" := documents_compute_search_vector(NEW."title", NEW."description", NEW."tags");
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_search_vector_trigger
  BEFORE INSERT OR UPDATE OF "title", "description", "tags" ON "documents"
  FOR EACH ROW EXECUTE FUNCTION documents_search_vector_update();

UPDATE "documents"
  SET "searchVector" = documents_compute_search_vector("title", "description", "tags");

CREATE INDEX "documents_searchVector_idx" ON "documents" USING GIN ("searchVector");
CREATE INDEX "documents_title_trgm_idx" ON "documents" USING GIN ("title" gin_trgm_ops);

-- Extracted text, one row per chunk.
ALTER TABLE "document_chunks" ADD COLUMN "searchVector" tsvector;

CREATE OR REPLACE FUNCTION document_chunks_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" := to_tsvector('english', coalesce(NEW."content", ''));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER document_chunks_search_vector_trigger
  BEFORE INSERT OR UPDATE OF "content" ON "document_chunks"
  FOR EACH ROW EXECUTE FUNCTION document_chunks_search_vector_update();

UPDATE "document_chunks" SET "searchVector" = to_tsvector('english', coalesce("content", ''));

CREATE INDEX "document_chunks_searchVector_idx" ON "document_chunks" USING GIN ("searchVector");

-- Structured (SRD) entries.
ALTER TABLE "structured_data" ADD COLUMN "searchVector" tsvector;

CREATE OR REPLACE FUNCTION structured_data_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" := to_tsvector('english', coalesce(NEW."searchText", ''));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER structured_data_search_vector_trigger
  BEFORE INSERT OR UPDATE OF "searchText" ON "structured_data"
  FOR EACH ROW EXECUTE FUNCTION structured_data_search_vector_update();

UPDATE "structured_data" SET "searchVector" = to_tsvector('english', coalesce("searchText", ''));

CREATE INDEX "structured_data_searchVector_idx" ON "structured_data" USING GIN ("searchVector");

-- Operational logs.
CREATE TABLE "log_events" (
  "id" BIGSERIAL NOT NULL,
  "timestamp" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "level" TEXT NOT NULL,
  "service" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "requestId" TEXT,
  "jobId" TEXT,
  "meta" JSONB,
  CONSTRAINT "log_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "log_events_timestamp_idx" ON "log_events" ("timestamp" DESC);
CREATE INDEX "log_events_service_timestamp_idx" ON "log_events" ("service", "timestamp" DESC);
CREATE INDEX "log_events_jobId_timestamp_idx" ON "log_events" ("jobId", "timestamp") WHERE "jobId" IS NOT NULL;
CREATE INDEX "log_events_message_trgm_idx" ON "log_events" USING GIN ("message" gin_trgm_ops);
