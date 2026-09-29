-- CreateTable
CREATE TABLE "processing_events" (
    "id" BIGSERIAL NOT NULL,
    "documentId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "pageNumber" INTEGER,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processing_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "processing_events_documentId_id_idx" ON "processing_events"("documentId", "id");

-- CreateIndex
CREATE INDEX "processing_events_documentId_runId_idx" ON "processing_events"("documentId", "runId");

