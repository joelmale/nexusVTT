-- AlterEnum
ALTER TYPE "DocumentTextSource" ADD VALUE 'layout';

-- CreateTable
CREATE TABLE "document_pages" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "markdown" TEXT NOT NULL,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "widthPt" DOUBLE PRECISION,
    "heightPt" DOUBLE PRECISION,
    "previewKey" TEXT,
    "quality" JSONB NOT NULL DEFAULT '{}',
    "engine" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_pages_documentId_idx" ON "document_pages"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "document_pages_documentId_pageNumber_key" ON "document_pages"("documentId", "pageNumber");

-- AddForeignKey
ALTER TABLE "document_pages" ADD CONSTRAINT "document_pages_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

