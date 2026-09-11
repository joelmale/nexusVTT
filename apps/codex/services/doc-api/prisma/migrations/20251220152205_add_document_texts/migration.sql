-- CreateEnum
CREATE TYPE "DocumentTextSource" AS ENUM ('pdf_extraction', 'ocr', 'markdown');

-- CreateTable
CREATE TABLE "document_texts" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "source" "DocumentTextSource" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_texts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_texts_source_idx" ON "document_texts"("source");

-- CreateIndex
CREATE UNIQUE INDEX "document_texts_documentId_source_key" ON "document_texts"("documentId", "source");

-- AddForeignKey
ALTER TABLE "document_texts" ADD CONSTRAINT "document_texts_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
