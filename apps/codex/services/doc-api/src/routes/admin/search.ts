import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../services/database.service';
import { elasticService } from '../../services/elastic.service';
import { z } from 'zod';

// Advanced search request schema
const AdvancedSearchSchema = z.object({
  titleQuery: z.string().optional(),
  contentQuery: z.string().optional(),
  tags: z.array(z.string()).optional(),
  type: z.enum(['rulebook', 'campaign_note', 'handout', 'map', 'character_sheet', 'homebrew']).optional(),
  dateRange: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }).optional(),
  minSize: z.number().optional(),
  maxSize: z.number().optional(),
  uploadedBy: z.string().optional(),
  campaigns: z.array(z.string()).optional(),
  page: z.number().optional().default(1),
  limit: z.number().optional().default(20),
});

type AdvancedSearchInput = z.infer<typeof AdvancedSearchSchema>;

export async function adminSearchRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/admin/search/advanced - Multi-field search with aggregations
   */
  fastify.post<{ Body: AdvancedSearchInput }>(
    '/api/admin/search/advanced',
    async (request: FastifyRequest<{ Body: AdvancedSearchInput }>, reply: FastifyReply) => {
      try {
        const query = AdvancedSearchSchema.parse(request.body);

        // Build Prisma where clause
        const where: any = {};

        if (query.type) {
          where.type = query.type;
        }

        if (query.tags && query.tags.length > 0) {
          where.tags = { hasSome: query.tags };
        }

        if (query.uploadedBy) {
          where.uploadedBy = query.uploadedBy;
        }

        if (query.campaigns && query.campaigns.length > 0) {
          where.campaigns = { hasSome: query.campaigns };
        }

        if (query.dateRange?.from || query.dateRange?.to) {
          where.uploadedAt = {};
          if (query.dateRange.from) {
            where.uploadedAt.gte = new Date(query.dateRange.from);
          }
          if (query.dateRange.to) {
            where.uploadedAt.lte = new Date(query.dateRange.to);
          }
        }

        if (query.minSize || query.maxSize) {
          where.fileSize = {};
          if (query.minSize) {
            where.fileSize.gte = query.minSize;
          }
          if (query.maxSize) {
            where.fileSize.lte = query.maxSize;
          }
        }

        // Add title search if provided
        if (query.titleQuery) {
          where.title = {
            contains: query.titleQuery,
            mode: 'insensitive',
          };
        }

        const skip = (query.page - 1) * query.limit;

        // If content search is requested, use ElasticSearch
        let elasticDocIds: string[] | null = null;
        if (query.contentQuery) {
          try {
            const elasticResults = await elasticService.search({
              query: query.contentQuery,
              size: 1000, // Get up to 1000 results from elastic
            });
            elasticDocIds = elasticResults.hits.map((r: any) => r.documentId);

            // Add elastic results to where clause
            if (elasticDocIds.length > 0) {
              where.id = { in: elasticDocIds };
            } else {
              // No results from content search
              return reply.send({
                documents: [],
                total: 0,
                page: query.page,
                limit: query.limit,
                facets: {},
              });
            }
          } catch (error) {
            fastify.log.error(`ElasticSearch error: ${error}`);
            // Continue with database search only
          }
        }

        // Execute search
        const [documents, total] = await Promise.all([
          prisma.document.findMany({
            where,
            skip,
            take: query.limit,
            orderBy: { uploadedAt: 'desc' },
            select: {
              id: true,
              title: true,
              description: true,
              type: true,
              format: true,
              fileSize: true,
              pageCount: true,
              thumbnailKey: true,
              author: true,
              uploadedBy: true,
              uploadedAt: true,
              lastModified: true,
              tags: true,
              collections: true,
              campaigns: true,
              ocrStatus: true,
              searchIndex: true,
            },
          }),
          prisma.document.count({ where }),
        ]);

        // Calculate facets (aggregations)
        const facets = await prisma.document.groupBy({
          by: ['type'],
          where,
          _count: { type: true },
        });

        const facetMap = facets.reduce((acc, facet) => {
          acc[facet.type] = facet._count.type;
          return acc;
        }, {} as Record<string, number>);

        return reply.send({
          documents,
          total,
          page: query.page,
          limit: query.limit,
          totalPages: Math.ceil(total / query.limit),
          facets: {
            byType: facetMap,
          },
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(400).send({
          error: 'Invalid search request',
          details: error.message,
        });
      }
    }
  );

  /**
   * GET /api/admin/search/similar/:id - Find similar documents
   */
  fastify.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    '/api/admin/search/similar/:id',
    async (request: FastifyRequest<{ Params: { id: string }; Querystring: { limit?: string } }>, reply: FastifyReply) => {
      try {
        const documentId = request.params.id;
        const limit = request.query.limit ? parseInt(request.query.limit, 10) : 10;

        // Get the source document
        const sourceDoc = await prisma.document.findUnique({
          where: { id: documentId },
          select: {
            id: true,
            title: true,
            contentHash: true,
            type: true,
            tags: true,
            fileSize: true,
          },
        });

        if (!sourceDoc) {
          return reply.status(404).send({ error: 'Document not found' });
        }

        const similarDocuments: Array<{
          document: any;
          similarity: {
            score: number;
            reasons: string[];
          };
        }> = [];

        // 1. Find exact content hash matches (duplicates)
        if (sourceDoc.contentHash) {
          const exactMatches = await prisma.document.findMany({
            where: {
              contentHash: sourceDoc.contentHash,
              id: { not: documentId },
            },
            take: limit,
          });

          exactMatches.forEach(doc => {
            similarDocuments.push({
              document: doc,
              similarity: {
                score: 1.0,
                reasons: ['Exact content match (duplicate)'],
              },
            });
          });
        }

        // 2. Find fuzzy title matches using PostgreSQL trigram similarity
        const fuzzyTitleMatches = await prisma.$queryRaw<any[]>`
          SELECT
            d.*,
            similarity(d.title, ${sourceDoc.title}) as title_similarity
          FROM documents d
          WHERE d.id != ${documentId}
            AND similarity(d.title, ${sourceDoc.title}) > 0.3
          ORDER BY title_similarity DESC
          LIMIT ${Math.min(limit, 20)}
        `;

        fuzzyTitleMatches.forEach(doc => {
          // Skip if already added as exact match
          if (similarDocuments.some(s => s.document.id === doc.id)) {
            return;
          }

          const reasons: string[] = [];
          let score = doc.title_similarity * 0.6; // Title similarity weighted at 60%

          // Add points for same type
          if (doc.type === sourceDoc.type) {
            score += 0.2;
            reasons.push('Same document type');
          }

          // Add points for shared tags
          const sharedTags = sourceDoc.tags.filter(tag => doc.tags.includes(tag));
          if (sharedTags.length > 0) {
            score += Math.min(sharedTags.length * 0.05, 0.2);
            reasons.push(`${sharedTags.length} shared tag(s)`);
          }

          // Add points for similar file size (within 10%)
          const sizeDiff = Math.abs(doc.fileSize - sourceDoc.fileSize) / sourceDoc.fileSize;
          if (sizeDiff < 0.1) {
            score += 0.1;
            reasons.push('Similar file size');
          }

          reasons.unshift(`Title similarity: ${Math.round(doc.title_similarity * 100)}%`);

          similarDocuments.push({
            document: doc,
            similarity: {
              score: Math.min(score, 0.99), // Cap at 0.99 since only exact content is 1.0
              reasons,
            },
          });
        });

        // Sort by similarity score and limit
        similarDocuments.sort((a, b) => b.similarity.score - a.similarity.score);
        const topResults = similarDocuments.slice(0, limit);

        return reply.send({
          sourceDocument: {
            id: sourceDoc.id,
            title: sourceDoc.title,
          },
          similarDocuments: topResults,
          total: topResults.length,
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to find similar documents',
          details: error.message,
        });
      }
    }
  );

  /**
   * GET /api/admin/search/facets - Get available filter options
   */
  fastify.get(
    '/api/admin/search/facets',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Get all unique values for faceted search
        const [types, allTags, campaigns, uploaders] = await Promise.all([
          prisma.document.groupBy({
            by: ['type'],
            _count: { type: true },
          }),
          prisma.$queryRaw<Array<{ tag: string; count: number }>>`
            SELECT unnest(tags) as tag, COUNT(*) as count
            FROM documents
            GROUP BY tag
            ORDER BY count DESC
            LIMIT 100
          `,
          prisma.$queryRaw<Array<{ campaign: string; count: number }>>`
            SELECT unnest(campaigns) as campaign, COUNT(*) as count
            FROM documents
            GROUP BY campaign
            ORDER BY count DESC
            LIMIT 100
          `,
          prisma.document.groupBy({
            by: ['uploadedBy'],
            _count: { uploadedBy: true },
          }),
        ]);

        return reply.send({
          types: types.map(t => ({ value: t.type, count: t._count.type })),
          tags: allTags.map(t => ({ value: t.tag, count: Number(t.count) })),
          campaigns: campaigns.map(c => ({ value: c.campaign, count: Number(c.count) })),
          uploaders: uploaders.map(u => ({ value: u.uploadedBy, count: u._count.uploadedBy })),
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to get facets',
          details: error.message,
        });
      }
    }
  );
}
