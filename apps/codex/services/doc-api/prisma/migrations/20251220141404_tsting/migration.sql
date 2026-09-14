-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('rulebook', 'campaign_note', 'handout', 'map', 'character_sheet', 'homebrew', 'srd_content');

-- CreateEnum
CREATE TYPE "DocumentFormat" AS ENUM ('pdf', 'markdown', 'html');

-- CreateEnum
CREATE TYPE "OcrStatus" AS ENUM ('pending', 'processing', 'completed', 'failed', 'not_required');

-- CreateEnum
CREATE TYPE "AnnotationType" AS ENUM ('highlight', 'note', 'drawing');

-- CreateEnum
CREATE TYPE "StructuredDataType" AS ENUM ('spell', 'item', 'monster', 'feat', 'class_feature', 'race', 'subrace', 'class_info', 'subclass', 'background', 'skill', 'language', 'rule', 'condition', 'damage_type', 'magic_school', 'weapon_property', 'alignment', 'trait', 'proficiency', 'ability_score', 'equipment_category', 'other');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'user');

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" "DocumentType" NOT NULL,
    "format" "DocumentFormat" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "thumbnailKey" TEXT,
    "author" TEXT NOT NULL DEFAULT '',
    "uploadedBy" TEXT NOT NULL,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastModified" TIMESTAMP(3) NOT NULL,
    "tags" TEXT[],
    "collections" TEXT[],
    "campaigns" TEXT[],
    "searchIndex" TEXT,
    "contentHash" TEXT,
    "ocrStatus" "OcrStatus" NOT NULL DEFAULT 'not_required',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_references" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT,
    "pageNumber" INTEGER,
    "section" TEXT,
    "textSelection" JSONB,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "tags" TEXT[],
    "color" TEXT,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAccessed" TIMESTAMP(3),

    CONSTRAINT "document_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_annotations" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "referenceId" TEXT,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT,
    "pageNumber" INTEGER NOT NULL,
    "position" JSONB NOT NULL,
    "type" "AnnotationType" NOT NULL,
    "content" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#FFFF00',
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "structured_data" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "type" "StructuredDataType" NOT NULL,
    "pageNumber" INTEGER,
    "section" TEXT,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "searchText" TEXT NOT NULL,
    "searchIndex" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "structured_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_metadata" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "color" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tag_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documents_uploadedBy_idx" ON "documents"("uploadedBy");

-- CreateIndex
CREATE INDEX "documents_type_idx" ON "documents"("type");

-- CreateIndex
CREATE INDEX "documents_campaigns_idx" ON "documents"("campaigns");

-- CreateIndex
CREATE INDEX "documents_tags_idx" ON "documents"("tags");

-- CreateIndex
CREATE INDEX "documents_contentHash_idx" ON "documents"("contentHash");

-- CreateIndex
CREATE INDEX "document_references_documentId_idx" ON "document_references"("documentId");

-- CreateIndex
CREATE INDEX "document_references_userId_idx" ON "document_references"("userId");

-- CreateIndex
CREATE INDEX "document_references_campaignId_idx" ON "document_references"("campaignId");

-- CreateIndex
CREATE INDEX "document_annotations_documentId_idx" ON "document_annotations"("documentId");

-- CreateIndex
CREATE INDEX "document_annotations_userId_idx" ON "document_annotations"("userId");

-- CreateIndex
CREATE INDEX "document_annotations_campaignId_idx" ON "document_annotations"("campaignId");

-- CreateIndex
CREATE INDEX "document_annotations_pageNumber_idx" ON "document_annotations"("pageNumber");

-- CreateIndex
CREATE INDEX "structured_data_documentId_idx" ON "structured_data"("documentId");

-- CreateIndex
CREATE INDEX "structured_data_type_idx" ON "structured_data"("type");

-- CreateIndex
CREATE INDEX "structured_data_name_idx" ON "structured_data"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tag_metadata_name_key" ON "tag_metadata"("name");

-- CreateIndex
CREATE INDEX "tag_metadata_category_idx" ON "tag_metadata"("category");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_references" ADD CONSTRAINT "document_references_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_references" ADD CONSTRAINT "document_references_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_annotations" ADD CONSTRAINT "document_annotations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_annotations" ADD CONSTRAINT "document_annotations_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_annotations" ADD CONSTRAINT "document_annotations_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "document_references"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structured_data" ADD CONSTRAINT "structured_data_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
