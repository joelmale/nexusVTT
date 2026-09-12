import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../services/database.service';
import {
  getQueueStats,
  getJobs,
  retryJob,
  removeJob,
  cleanOldJobs,
} from '../../services/queue.service';
import { loggingService } from '../../services/logging.service';

export async function adminQueueRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/admin/queue/stats - Job counts by status
   */
  fastify.get('/api/admin/queue/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await getQueueStats();
      return reply.send(stats);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Failed to get queue stats',
        details: error.message,
      });
    }
  });

  /**
   * GET /api/admin/queue/jobs - List jobs with filters
   */
  fastify.get<{ Querystring: { status?: string; limit?: string; offset?: string } }>(
    '/api/admin/queue/jobs',
    async (request: FastifyRequest<{ Querystring: { status?: string; limit?: string; offset?: string } }>, reply: FastifyReply) => {
      try {
        const { status, limit, offset } = request.query;

        const filters: any = {};
        if (status && ['waiting', 'active', 'completed', 'failed'].includes(status)) {
          filters.status = status;
        }
        if (limit) {
          filters.limit = parseInt(limit, 10);
        }
        if (offset) {
          filters.offset = parseInt(offset, 10);
        }

        const jobs = await getJobs(filters);

        // Enrich with document titles
        const enrichedJobs = await Promise.all(
          jobs.map(async (job) => {
            try {
              const document = await prisma.document.findUnique({
                where: { id: job.documentId },
                select: { title: true },
              });
              return {
                ...job,
                documentTitle: document?.title || 'Unknown Document',
              };
            } catch (error) {
              return {
                ...job,
                documentTitle: 'Unknown Document',
              };
            }
          })
        );

        return reply.send({
          jobs: enrichedJobs,
          total: enrichedJobs.length, // Note: This is approximate for filtered results
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to get jobs',
          details: error.message,
        });
      }
    }
  );

  /**
   * POST /api/admin/queue/jobs/:id/retry - Retry specific failed job
   */
  fastify.post<{ Params: { id: string } }>(
    '/api/admin/queue/jobs/:id/retry',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const jobId = request.params.id;
        const result = await retryJob(jobId);
        return reply.send(result);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(400).send({
          error: 'Failed to retry job',
          details: error.message,
        });
      }
    }
  );

  /**
   * DELETE /api/admin/queue/jobs/:id - Remove job from queue
   */
  fastify.delete<{ Params: { id: string } }>(
    '/api/admin/queue/jobs/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const jobId = request.params.id;
        const result = await removeJob(jobId);
        return reply.send(result);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(400).send({
          error: 'Failed to remove job',
          details: error.message,
        });
      }
    }
  );

  /**
   * POST /api/admin/queue/clean - Clean completed/failed jobs older than X days
   */
  fastify.post<{ Body: { olderThanDays?: number } }>(
    '/api/admin/queue/clean',
    async (request: FastifyRequest<{ Body: { olderThanDays?: number } }>, reply: FastifyReply) => {
      try {
        const { olderThanDays = 7 } = request.body || {};
        const result = await cleanOldJobs(olderThanDays);
        return reply.send(result);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to clean jobs',
          details: error.message,
        });
      }
    }
  );

  /**
   * GET /api/admin/queue/jobs/:id/logs - Get processing logs for a job
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/admin/queue/jobs/:id/logs',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const jobId = request.params.id;
        const logs = await loggingService.getLogs(jobId);

        return reply.send({
          jobId,
          logs,
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to get job logs',
          details: error.message,
        });
      }
    }
  );
}