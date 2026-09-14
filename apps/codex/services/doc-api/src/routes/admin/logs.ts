import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { loggingService, LogLevel } from '../../services/logging.service';

export async function adminLogsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/admin/logs - Query centralized logs
   */
  fastify.get(
    '/api/admin/logs',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as {
          service?: string;
          level?: string;
          q?: string;
          from?: string;
          to?: string;
          limit?: string;
          offset?: string;
        };

        const services = query.service ? query.service.split(',').map(s => s.trim()).filter(Boolean) : undefined;
        const levels = query.level
          ? query.level.split(',').map(l => l.trim()).filter(Boolean) as LogLevel[]
          : undefined;

        const result = await loggingService.search({
          services,
          levels,
          query: query.q,
          from: query.from,
          to: query.to,
          limit: query.limit ? parseInt(query.limit, 10) : 100,
          offset: query.offset ? parseInt(query.offset, 10) : 0,
        });

        return reply.send(result);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to query logs',
          details: error.message,
        });
      }
    }
  );
}
