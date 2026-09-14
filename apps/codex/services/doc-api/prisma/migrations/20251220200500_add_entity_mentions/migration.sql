-- CreateTable
CREATE TABLE "entity_mentions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "sourceEntityId" TEXT,
    "mentionText" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "targetType" "StructuredDataType" NOT NULL,
    "resolvedEntityId" TEXT,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_mentions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "entity_mentions_documentId_idx" ON "entity_mentions"("documentId");

-- CreateIndex
CREATE INDEX "entity_mentions_targetType_idx" ON "entity_mentions"("targetType");

-- CreateIndex
CREATE INDEX "entity_mentions_resolvedEntityId_idx" ON "entity_mentions"("resolvedEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "entity_links_sourceEntityId_targetEntityId_type_key" ON "entity_links"("sourceEntityId", "targetEntityId", "type");

-- AddForeignKey
ALTER TABLE "entity_mentions" ADD CONSTRAINT "entity_mentions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_mentions" ADD CONSTRAINT "entity_mentions_sourceEntityId_fkey" FOREIGN KEY ("sourceEntityId") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_mentions" ADD CONSTRAINT "entity_mentions_resolvedEntityId_fkey" FOREIGN KEY ("resolvedEntityId") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
