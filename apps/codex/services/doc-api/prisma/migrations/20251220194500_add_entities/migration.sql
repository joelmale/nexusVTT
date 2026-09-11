-- CreateEnum
CREATE TYPE "EntityLinkType" AS ENUM ('uses', 'references', 'related');

-- AlterTable
ALTER TABLE "structured_data" ADD COLUMN "entityId" TEXT;

-- CreateTable
CREATE TABLE "entities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "StructuredDataType" NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_aliases" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityType" "StructuredDataType" NOT NULL,
    "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_links" (
    "id" TEXT NOT NULL,
    "sourceEntityId" TEXT NOT NULL,
    "targetEntityId" TEXT NOT NULL,
    "type" "EntityLinkType" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "entities_type_normalizedName_key" ON "entities"("type", "normalizedName");

-- CreateIndex
CREATE INDEX "entities_type_idx" ON "entities"("type");

-- CreateIndex
CREATE UNIQUE INDEX "entity_aliases_entityType_normalizedAlias_key" ON "entity_aliases"("entityType", "normalizedAlias");

-- CreateIndex
CREATE INDEX "entity_aliases_entityId_idx" ON "entity_aliases"("entityId");

-- CreateIndex
CREATE INDEX "entity_links_sourceEntityId_idx" ON "entity_links"("sourceEntityId");

-- CreateIndex
CREATE INDEX "entity_links_targetEntityId_idx" ON "entity_links"("targetEntityId");

-- CreateIndex
CREATE INDEX "entity_links_type_idx" ON "entity_links"("type");

-- CreateIndex
CREATE INDEX "structured_data_entityId_idx" ON "structured_data"("entityId");

-- AddForeignKey
ALTER TABLE "structured_data" ADD CONSTRAINT "structured_data_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_aliases" ADD CONSTRAINT "entity_aliases_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_links" ADD CONSTRAINT "entity_links_sourceEntityId_fkey" FOREIGN KEY ("sourceEntityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_links" ADD CONSTRAINT "entity_links_targetEntityId_fkey" FOREIGN KEY ("targetEntityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
