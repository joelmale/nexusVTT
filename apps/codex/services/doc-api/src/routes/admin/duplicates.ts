import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../services/database.service';
import { contentHashService } from '../../services/content-hash.service';
import { s3Service } from '../../services/s3.service';
import { elasticService } from '../../services/elastic.service';
import { z } from 'zod';

// Merge duplicates request schema
const MergeDuplicatesSchema = z.object({
  keepDocumentId: z.string().uuid(),
  deleteDocumentIds: z.array(z.string().uuid()).min(1),
  mergeTags: z.boolean().optional().default(true),
  mergeCampaigns: z.boolean().optional().default(true),
  mergeCollections: z.boolean().optional().default(true),
  mergeReferences: z.boolean().optional().default(false),
  mergeAnnotations: z.boolean().optional().default(false),
});

type MergeDuplicatesInput = z.infer<typeof MergeDuplicatesSchema>;

export async function adminDuplicatesRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/admin/duplicates - List potential duplicates
   */
  fastify.get<{ Querystring: { minConfidence?: string } }>(
    '/api/admin/duplicates',
    async (request: FastifyRequest<{ Querystring: { minConfidence?: string } }>, reply: FastifyReply) => {
      try {
        const minConfidence = request.query.minConfidence || 'exact';
        const allowedConfidence = ['exact', 'likely', 'possible'];

        if (!allowedConfidence.includes(minConfidence)) {
          return reply.status(400).send({
            error: 'Invalid minConfidence value',
            details: 'Must be one of: exact, likely, possible',
          });
        }

        const duplicateGroups: Array<{
          confidence: 'exact' | 'likely' | 'possible';
          reason: string;
          documents: any[];
        }> = [];

        // 1. Find exact content hash matches
        const exactDuplicates = await contentHashService.findAllDuplicates();

        for (const group of exactDuplicates) {
          duplicateGroups.push({
            confidence: 'exact',
            reason: 'Identical file content (SHA-256 hash match)',
            documents: group.documents,
          });
        }

        // 2. Find likely duplicates by title similarity (if requested)
        if (minConfidence === 'likely' || minConfidence === 'possible') {
          // Use PostgreSQL trigram similarity to find similar titles
          const likelyDuplicates = await prisma.$queryRaw<any[]>`
            WITH title_pairs AS (
              SELECT
                d1.id as id1,
                d2.id as id2,
                d1.title as title1,
                d2.title as title2,
                similarity(d1.title, d2.title) as sim,
                d1.file_size as size1,
                d2.file_size as size2,
                d1.type as type1,
                d2.type as type2
              FROM documents d1
              JOIN documents d2 ON d1.id < d2.id
              WHERE similarity(d1.title, d2.title) > 0.6
                AND d1.content_hash IS NULL OR d2.content_hash IS NULL OR d1.content_hash != d2.content_hash
            )
            SELECT * FROM title_pairs
            ORDER BY sim DESC
            LIMIT 50
          `;

          // Group likely duplicates
          const processedPairs = new Set<string>();

          for (const pair of likelyDuplicates) {
            const pairKey = [pair.id1, pair.id2].sort().join('-');
            if (processedPairs.has(pairKey)) continue;
            processedPairs.add(pairKey);

            // Fetch full document details
            const [doc1, doc2] = await Promise.all([
              prisma.document.findUnique({ where: { id: pair.id1 } }),
              prisma.document.findUnique({ where: { id: pair.id2 } }),
            ]);

            if (!doc1 || !doc2) continue;

            // Calculate similarity score
            let reason = `Title similarity: ${Math.round(pair.sim * 100)}%`;
            const reasons = [reason];

            // Check file size similarity
            const sizeDiff = Math.abs(pair.size1 - pair.size2) / Math.max(pair.size1, pair.size2);
            if (sizeDiff < 0.05) {
              reasons.push('Very similar file size');
            }

            // Check same type
            if (pair.type1 === pair.type2) {
              reasons.push('Same document type');
            }

            duplicateGroups.push({
              confidence: pair.sim > 0.8 ? 'likely' : 'possible',
              reason: reasons.join(', '),
              documents: [
                {
                  id: doc1.id,
                  title: doc1.title,
                  uploadedAt: doc1.uploadedAt.toISOString(),
                  uploadedBy: doc1.uploadedBy,
                },
                {
                  id: doc2.id,
                  title: doc2.title,
                  uploadedAt: doc2.uploadedAt.toISOString(),
                  uploadedBy: doc2.uploadedBy,
                },
              ],
            });
          }
        }

        // Filter by confidence level
        const filteredGroups = duplicateGroups.filter(group => {
          if (minConfidence === 'exact') return group.confidence === 'exact';
          if (minConfidence === 'likely') return group.confidence === 'exact' || group.confidence === 'likely';
          return true; // 'possible' includes all
        });

        return reply.send({
          duplicateGroups: filteredGroups,
          total: filteredGroups.length,
          summary: {
            exact: duplicateGroups.filter(g => g.confidence === 'exact').length,
            likely: duplicateGroups.filter(g => g.confidence === 'likely').length,
            possible: duplicateGroups.filter(g => g.confidence === 'possible').length,
          },
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to find duplicates',
          details: error.message,
        });
      }
    }
  );

  /**
   * POST /api/admin/duplicates/merge - Merge duplicate documents
   */
  fastify.post<{ Body: MergeDuplicatesInput }>(
    '/api/admin/duplicates/merge',
    async (request: FastifyRequest<{ Body: MergeDuplicatesInput }>, reply: FastifyReply) => {
      try {
        const data = MergeDuplicatesSchema.parse(request.body);

        // Verify all documents exist
        const allDocIds = [data.keepDocumentId, ...data.deleteDocumentIds];
        const documents = await prisma.document.findMany({
          where: { id: { in: allDocIds } },
          include: {
            references: true,
            annotations: true,
          },
        });

        if (documents.length !== allDocIds.length) {
          return reply.status(404).send({
            error: 'One or more documents not found',
          });
        }

        const primaryDoc = documents.find(d => d.id === data.keepDocumentId);
        const duplicateDocs = documents.filter(d => data.deleteDocumentIds.includes(d.id));

        if (!primaryDoc) {
          return reply.status(404).send({ error: 'Primary document not found' });
        }

        // Merge metadata
        const mergedTags = data.mergeTags
          ? Array.from(new Set([...primaryDoc.tags, ...duplicateDocs.flatMap(d => d.tags)]))
          : primaryDoc.tags;

        const mergedCampaigns = data.mergeCampaigns
          ? Array.from(new Set([...primaryDoc.campaigns, ...duplicateDocs.flatMap(d => d.campaigns)]))
          : primaryDoc.campaigns;

        const mergedCollections = data.mergeCollections
          ? Array.from(new Set([...primaryDoc.collections, ...duplicateDocs.flatMap(d => d.collections)]))
          : primaryDoc.collections;

        // Update primary document with merged metadata
        const existingMetadata = typeof primaryDoc.metadata === 'object' && primaryDoc.metadata !== null
          ? primaryDoc.metadata as Record<string, any>
          : {};

        await prisma.document.update({
          where: { id: data.keepDocumentId },
          data: {
            tags: mergedTags,
            campaigns: mergedCampaigns,
            collections: mergedCollections,
            metadata: {
              ...existingMetadata,
              mergedFrom: data.deleteDocumentIds,
              mergedAt: new Date().toISOString(),
            },
          },
        });

        // Optionally merge references and annotations
        if (data.mergeReferences) {
          for (const duplicate of duplicateDocs) {
            await prisma.documentReference.updateMany({
              where: { documentId: duplicate.id },
              data: { documentId: data.keepDocumentId },
            });
          }
        }

        if (data.mergeAnnotations) {
          for (const duplicate of duplicateDocs) {
            await prisma.documentAnnotation.updateMany({
              where: { documentId: duplicate.id },
              data: { documentId: data.keepDocumentId },
            });
          }
        }

        // Delete duplicate documents
        for (const duplicate of duplicateDocs) {
          // Delete from ElasticSearch
          if (duplicate.searchIndex) {
            try {
              await elasticService.deleteDocument(duplicate.searchIndex);
            } catch (error) {
              fastify.log.warn(`Failed to delete from ElasticSearch: ${error}`);
            }
          }

          // Delete from S3 (only if not merging references/annotations to avoid orphaning data)
          if (!data.mergeReferences && !data.mergeAnnotations) {
            try {
              await s3Service.deleteObject(duplicate.storageKey);
              if (duplicate.thumbnailKey) {
                await s3Service.deleteObject(duplicate.thumbnailKey);
              }
            } catch (error) {
              fastify.log.warn(`Failed to delete from S3: ${error}`);
            }
          }

          // Delete from database (cascade will handle references/annotations if not merged)
          await prisma.document.delete({
            where: { id: duplicate.id },
          });
        }

        return reply.send({
          message: 'Duplicates merged successfully',
          primaryDocument: data.keepDocumentId,
          deletedDocuments: data.deleteDocumentIds,
          mergedMetadata: {
            tags: mergedTags.length,
            campaigns: mergedCampaigns.length,
            collections: mergedCollections.length,
          },
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(400).send({
          error: 'Failed to merge duplicates',
          details: error.message,
        });
      }
    }
  );

  /**
   * POST /api/admin/duplicates/preview-merge - Preview merge without executing
   */
  fastify.post<{ Body: MergeDuplicatesInput }>(
    '/api/admin/duplicates/preview-merge',
    async (request: FastifyRequest<{ Body: MergeDuplicatesInput }>, reply: FastifyReply) => {
      try {
        const data = MergeDuplicatesSchema.parse(request.body);

        // Verify all documents exist
        const allDocIds = [data.keepDocumentId, ...data.deleteDocumentIds];
        const documents = await prisma.document.findMany({
          where: { id: { in: allDocIds } },
          include: {
            references: { select: { id: true } },
            annotations: { select: { id: true } },
          },
        });

        if (documents.length !== allDocIds.length) {
          return reply.status(404).send({
            error: 'One or more documents not found',
          });
        }

        const primaryDoc = documents.find(d => d.id === data.keepDocumentId);
        const duplicateDocs = documents.filter(d => data.deleteDocumentIds.includes(d.id));

        if (!primaryDoc) {
          return reply.status(404).send({ error: 'Primary document not found' });
        }

        // Calculate merged metadata
        const currentTags = primaryDoc.tags;
        const newTags = data.mergeTags
          ? Array.from(new Set([...primaryDoc.tags, ...duplicateDocs.flatMap(d => d.tags)]))
          : primaryDoc.tags;

        const currentCampaigns = primaryDoc.campaigns;
        const newCampaigns = data.mergeCampaigns
          ? Array.from(new Set([...primaryDoc.campaigns, ...duplicateDocs.flatMap(d => d.campaigns)]))
          : primaryDoc.campaigns;

        const currentCollections = primaryDoc.collections;
        const newCollections = data.mergeCollections
          ? Array.from(new Set([...primaryDoc.collections, ...duplicateDocs.flatMap(d => d.collections)]))
          : primaryDoc.collections;

        const totalReferences = duplicateDocs.reduce((sum, d) => sum + d.references.length, 0);
        const totalAnnotations = duplicateDocs.reduce((sum, d) => sum + d.annotations.length, 0);
        const totalFileSize = duplicateDocs.reduce((sum, d) => sum + d.fileSize, 0);

        return reply.send({
          preview: {
            primaryDocument: {
              id: primaryDoc.id,
              title: primaryDoc.title,
              currentTags,
              currentCampaigns,
              currentCollections,
            },
            duplicateDocuments: duplicateDocs.map(d => ({
              id: d.id,
              title: d.title,
              tags: d.tags,
              campaigns: d.campaigns,
              collections: d.collections,
              references: d.references.length,
              annotations: d.annotations.length,
              fileSize: d.fileSize,
            })),
            afterMerge: {
              tags: newTags,
              addedTags: newTags.filter(t => !currentTags.includes(t)),
              campaigns: newCampaigns,
              addedCampaigns: newCampaigns.filter(c => !currentCampaigns.includes(c)),
              collections: newCollections,
              addedCollections: newCollections.filter(c => !currentCollections.includes(c)),
            },
            willMerge: {
              references: data.mergeReferences ? totalReferences : 0,
              annotations: data.mergeAnnotations ? totalAnnotations : 0,
            },
            willDelete: {
              documents: data.deleteDocumentIds.length,
              totalFileSize,
              storageFreed: `${(totalFileSize / (1024 * 1024)).toFixed(2)} MB`,
            },
          },
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(400).send({
          error: 'Failed to preview merge',
          details: error.message,
        });
      }
    }
  );

  /**
   * GET /api/admin/duplicates/stats - Get duplicate statistics
   */
  fastify.get(
    '/api/admin/duplicates/stats',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Count documents with duplicate content hashes
        const documentsWithHash = await prisma.document.findMany({
          where: { contentHash: { not: null } },
          select: { contentHash: true, fileSize: true },
        });

        const hashCounts = new Map<string, number>();
        const hashSizes = new Map<string, number>();

        for (const doc of documentsWithHash) {
          if (!doc.contentHash) continue;
          hashCounts.set(doc.contentHash, (hashCounts.get(doc.contentHash) || 0) + 1);
          if (!hashSizes.has(doc.contentHash)) {
            hashSizes.set(doc.contentHash, doc.fileSize);
          }
        }

        const duplicateHashes = Array.from(hashCounts.entries()).filter(([, count]) => count > 1);
        const totalDuplicateDocuments = duplicateHashes.reduce((sum, [, count]) => sum + count - 1, 0);

        // Calculate wasted storage (sum of all duplicate file sizes)
        const wastedStorage = duplicateHashes.reduce((sum, [hash, count]) => {
          const size = hashSizes.get(hash) || 0;
          return sum + (size * (count - 1));
        }, 0);

        return reply.send({
          totalDocuments: await prisma.document.count(),
          documentsWithHash: documentsWithHash.length,
          duplicateGroups: duplicateHashes.length,
          totalDuplicateDocuments,
          wastedStorage: {
            bytes: wastedStorage,
            megabytes: (wastedStorage / (1024 * 1024)).toFixed(2),
            gigabytes: (wastedStorage / (1024 * 1024 * 1024)).toFixed(2),
          },
          potentialSavings: {
            documents: totalDuplicateDocuments,
            storage: `${(wastedStorage / (1024 * 1024)).toFixed(2)} MB`,
          },
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to get duplicate stats',
          details: error.message,
        });
      }
    }
  );
}
