import { createHash } from 'crypto';
import { prisma } from './database.service';

export class ContentHashService {
  /**
   * Calculate SHA-256 hash of file content
   */
  calculateHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Check if a document with the same content hash already exists
   */
  async findDuplicate(hash: string, excludeDocumentId?: string): Promise<string | null> {
    const existing = await prisma.document.findFirst({
      where: {
        contentHash: hash,
        ...(excludeDocumentId && { id: { not: excludeDocumentId } }),
      },
      select: { id: true },
    });

    return existing?.id || null;
  }

  /**
   * Store content hash for a document
   */
  async storeHash(documentId: string, hash: string): Promise<void> {
    await prisma.document.update({
      where: { id: documentId },
      data: { contentHash: hash },
    });
  }

  /**
   * Get content hash for a document
   */
  async getHash(documentId: string): Promise<string | null> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { contentHash: true },
    });

    return document?.contentHash || null;
  }

  /**
   * Find all documents with duplicate content hashes
   */
  async findAllDuplicates(): Promise<Array<{
    hash: string;
    documents: Array<{
      id: string;
      title: string;
      uploadedAt: string;
      uploadedBy: string;
    }>;
  }>> {
    // Get all documents with content hashes
    const documents = await prisma.document.findMany({
      where: { contentHash: { not: null } },
      select: {
        id: true,
        title: true,
        contentHash: true,
        uploadedAt: true,
        uploadedBy: true,
      },
      orderBy: { uploadedAt: 'asc' },
    });

    // Group by hash
    const hashGroups = new Map<string, Array<{
      id: string;
      title: string;
      uploadedAt: string;
      uploadedBy: string;
    }>>();

    for (const doc of documents) {
      if (!doc.contentHash) continue;

      if (!hashGroups.has(doc.contentHash)) {
        hashGroups.set(doc.contentHash, []);
      }

      hashGroups.get(doc.contentHash)!.push({
        id: doc.id,
        title: doc.title,
        uploadedAt: doc.uploadedAt.toISOString(),
        uploadedBy: doc.uploadedBy,
      });
    }

    // Return only groups with duplicates (more than 1 document)
    return Array.from(hashGroups.entries())
      .filter(([, docs]) => docs.length > 1)
      .map(([hash, documents]) => ({ hash, documents }));
  }

  /**
   * Merge duplicate document metadata
   * Keeps the oldest document as primary and merges tags/campaigns from duplicates
   */
  async mergeDuplicates(primaryId: string, duplicateIds: string[]): Promise<void> {
    // Get all documents involved
    const documents = await prisma.document.findMany({
      where: {
        id: { in: [primaryId, ...duplicateIds] },
      },
      select: {
        id: true,
        tags: true,
        campaigns: true,
        collections: true,
      },
    });

    const primary = documents.find(d => d.id === primaryId);
    const duplicates = documents.filter(d => d.id !== primaryId);

    if (!primary) {
      throw new Error(`Primary document ${primaryId} not found`);
    }

    // Merge tags, campaigns, and collections
    const allTags = new Set(primary.tags);
    const allCampaigns = new Set(primary.campaigns);
    const allCollections = new Set(primary.collections);

    for (const duplicate of duplicates) {
      duplicate.tags.forEach(tag => allTags.add(tag));
      duplicate.campaigns.forEach(campaign => allCampaigns.add(campaign));
      duplicate.collections.forEach(collection => allCollections.add(collection));
    }

    // Update primary document with merged metadata
    await prisma.document.update({
      where: { id: primaryId },
      data: {
        tags: Array.from(allTags),
        campaigns: Array.from(allCampaigns),
        collections: Array.from(allCollections),
      },
    });

    // Mark duplicates as such (you might want to add a status field for this)
    // For now, we'll just update their metadata to indicate they're duplicates
    for (const duplicateId of duplicateIds) {
      await prisma.document.update({
        where: { id: duplicateId },
        data: {
          metadata: {
            duplicateOf: primaryId,
            mergedAt: new Date().toISOString(),
          },
        },
      });
    }
  }
}

export const contentHashService = new ContentHashService();