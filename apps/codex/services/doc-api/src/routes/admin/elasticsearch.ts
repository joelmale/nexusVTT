import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ElasticSearchManagementService } from '../../services/elasticsearch-management.service';

const ReindexQuerySchema = z.object({
  batchSize: z.string().optional().default('100').transform(Number),
  force: z.string().optional().default('false').transform(val => val === 'true'),
  indexName: z.string().optional(),
});

export async function elasticsearchRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/admin/elasticsearch/health - Get ElasticSearch cluster and index health
   */
  fastify.get('/api/admin/elasticsearch/health', async (_request, reply) => {
    try {
      const health = await ElasticSearchManagementService.getIndexHealth();
      return reply.send(health);
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to get ElasticSearch health',
        details: error.message,
      });
    }
  });

  /**
   * POST /api/admin/elasticsearch/reindex - Reindex documents from database
   */
  fastify.post('/api/admin/elasticsearch/reindex', async (request, reply) => {
    const query = ReindexQuerySchema.parse(request.query);

    try {
      const result = await ElasticSearchManagementService.reindexDocuments(query);
      return reply.send(result);
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Reindex operation failed',
        details: error.message,
      });
    }
  });

  /**
   * POST /api/admin/elasticsearch/recreate-index - Delete and recreate index
   */
  fastify.post('/api/admin/elasticsearch/recreate-index', async (request, reply) => {
    const { indexName } = request.query as { indexName?: string };

    try {
      await ElasticSearchManagementService.recreateIndex(indexName);
      return reply.send({ message: 'Index recreated successfully' });
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Index recreation failed',
        details: error.message,
      });
    }
  });

  /**
   * POST /api/admin/elasticsearch/optimize - Optimize index (force merge)
   */
  fastify.post('/api/admin/elasticsearch/optimize', async (request, reply) => {
    const { indexName } = request.query as { indexName?: string };

    try {
      await ElasticSearchManagementService.optimizeIndex(indexName);
      return reply.send({ message: 'Index optimized successfully' });
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Index optimization failed',
        details: error.message,
      });
    }
  });

  /**
   * GET /api/admin/elasticsearch/stats - Get search performance statistics
   */
  fastify.get('/api/admin/elasticsearch/stats', async (_request, reply) => {
    try {
      const stats = await ElasticSearchManagementService.getSearchStats();
      return reply.send(stats);
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to get search statistics',
        details: error.message,
      });
    }
  });

  /**
   * DELETE /api/admin/elasticsearch/clear - Clear all documents from index
   */
  fastify.delete('/api/admin/elasticsearch/clear', async (request, reply) => {
    const { indexName } = request.query as { indexName?: string };

    try {
      await ElasticSearchManagementService.clearIndex(indexName);
      return reply.send({ message: 'Index cleared successfully' });
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Index clear failed',
        details: error.message,
      });
    }
  });
}