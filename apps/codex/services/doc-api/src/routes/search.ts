import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { elasticService } from '../services/elastic.service';
import { contentHashService } from '../services/content-hash.service';
import { searchChunks } from '../services/chunk-search.service';
import { generateGroundedAnswer } from '../services/llm.service';
import { SearchQuerySchema, QuickSearchQuerySchema, AdvancedSearchQuerySchema, SemanticSearchQuerySchema, AskSearchSchema, SearchQuery, QuickSearchQuery, AdvancedSearchQuery, SemanticSearchQuery, AskSearchInput } from '../types/search';

export async function searchRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/search - Full-text search across documents
   */
  fastify.get<{ Querystring: SearchQuery }>(
    '/api/search',
    async (request: FastifyRequest<{ Querystring: SearchQuery }>, reply: FastifyReply) => {
      try {
        const params = SearchQuerySchema.parse(request.query);

        const results = await elasticService.search({
          query: params.query,
          filters: {
            type: params.type,
            campaigns: params.campaigns,
            tags: params.tags,
          },
          from: params.from,
          size: params.size,
        });

        return reply.send({
          query: params.query,
          total: results.total,
          from: params.from,
          size: params.size,
          results: results.hits,
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(400).send({
          error: 'Search failed',
          details: error.message,
        });
      }
    }
  );

  /**
   * GET /api/search/quick - Quick search for top results
   */
  fastify.get<{ Querystring: QuickSearchQuery }>(
    '/api/search/quick',
    async (request: FastifyRequest<{ Querystring: QuickSearchQuery }>, reply: FastifyReply) => {
      try {
        const params = QuickSearchQuerySchema.parse(request.query);

        const results = await elasticService.search({
          query: params.query,
          filters: params.campaign ? { campaigns: [params.campaign] } : undefined,
          from: 0,
          size: params.size,
        });

        // Format quick results with snippets
        const quickResults = results.hits.map((hit: any) => ({
          documentId: hit.documentId,
          title: hit.source.title,
          type: hit.source.type,
          score: hit.score,
          snippet: hit.highlights?.content?.[0] || hit.source.description || '',
        }));

        return reply.send({
          query: params.query,
          results: quickResults,
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(400).send({
          error: 'Quick search failed',
          details: error.message,
        });
      }
    }
  );

  /**
   * GET /api/search/advanced - Advanced search with enhanced filters and sorting
   */
  fastify.get<{ Querystring: AdvancedSearchQuery }>(
    '/api/search/advanced',
    async (request: FastifyRequest<{ Querystring: AdvancedSearchQuery }>, reply: FastifyReply) => {
      try {
        const params = AdvancedSearchQuerySchema.parse(request.query);

        const results = await elasticService.advancedSearch({
          query: params.query,
          filters: {
            type: params.type,
            campaigns: params.campaigns,
            tags: params.tags,
            uploadedBy: params.uploadedBy,
            uploadedAfter: params.uploadedAfter,
            uploadedBefore: params.uploadedBefore,
          },
          sortBy: params.sortBy,
          sortOrder: params.sortOrder,
          from: params.from,
          size: params.size,
        });

        return reply.send({
          query: params.query,
          total: results.total,
          from: params.from,
          size: params.size,
          sortBy: params.sortBy,
          sortOrder: params.sortOrder,
          results: results.hits,
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(400).send({
          error: 'Advanced search failed',
          details: error.message,
        });
      }
    }
  );

  /**
   * GET /api/search/semantic - Hybrid semantic search over document chunks
   */
  fastify.get<{ Querystring: SemanticSearchQuery }>(
    '/api/search/semantic',
    async (request: FastifyRequest<{ Querystring: SemanticSearchQuery }>, reply: FastifyReply) => {
      try {
        const params = SemanticSearchQuerySchema.parse(request.query);
        const results = await searchChunks({
          query: params.query,
          topK: params.topK,
          filters: {
            type: params.type,
            campaigns: params.campaigns,
            tags: params.tags,
          },
        });

        return reply.send({
          query: params.query,
          total: results.length,
          provider: 'hybrid',
          results,
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Semantic search failed',
          details: error.message,
        });
      }
    }
  );

  /**
   * POST /api/search/ask - Grounded Q&A using retrieved chunks
   */
  fastify.post<{ Body: AskSearchInput }>(
    '/api/search/ask',
    async (request: FastifyRequest<{ Body: AskSearchInput }>, reply: FastifyReply) => {
      try {
        const params = AskSearchSchema.parse(request.body);
        const results = await searchChunks({
          query: params.question,
          topK: params.topK,
          filters: {
            type: params.type,
            campaigns: params.campaigns,
            tags: params.tags,
          },
        });

        const snippets = results.map((result) => result.contentSnippet);
        const citations = results.map((result, index) => ({
          sourceIndex: index + 1,
          documentId: result.documentId,
          title: result.document.title,
          pageStart: result.pageStart,
          pageEnd: result.pageEnd,
          chunkId: result.chunkId,
          confidence: result.score,
        }));

        let answer = 'Insufficient sources to answer.';
        let confidence = 0.1;
        if (results.length >= 2 && snippets.join(' ').length > 200) {
          const grounded = await generateGroundedAnswer({
            question: params.question,
            snippets,
          });
          if (grounded) {
            answer = grounded;
            confidence = 0.7;
          }
        }

        return reply.send({
          question: params.question,
          answer,
          confidence,
          citations,
          snippets,
          followups: [],
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Ask search failed',
          details: error.message,
        });
      }
    }
  );

  /**
   * GET /api/deduplication/duplicates - Find all duplicate documents
   */
  fastify.get('/api/deduplication/duplicates', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const duplicates = await contentHashService.findAllDuplicates();

      return reply.send({
        duplicates,
        totalGroups: duplicates.length,
        totalDocuments: duplicates.reduce((sum, group) => sum + group.documents.length, 0),
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Failed to find duplicates',
        details: error.message,
      });
    }
  });

  /**
   * POST /api/deduplication/merge - Merge duplicate documents
   */
  fastify.post<{ Body: { primaryId: string; duplicateIds: string[] } }>(
    '/api/deduplication/merge',
    async (request: FastifyRequest<{ Body: { primaryId: string; duplicateIds: string[] } }>, reply: FastifyReply) => {
      try {
        const { primaryId, duplicateIds } = request.body;

        if (!primaryId || !duplicateIds || duplicateIds.length === 0) {
          return reply.status(400).send({
            error: 'Invalid request',
            details: 'primaryId and duplicateIds are required',
          });
        }

        await contentHashService.mergeDuplicates(primaryId, duplicateIds);

        return reply.send({
          message: 'Duplicates merged successfully',
          primaryId,
          mergedDuplicates: duplicateIds.length,
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to merge duplicates',
          details: error.message,
        });
      }
    }
  );
}
