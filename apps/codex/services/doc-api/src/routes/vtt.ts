import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { vttService } from '../services/vtt.service';

export async function vttRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/vtt/export/:entityId - Export entity for VTTs
   */
  fastify.get<{ Params: { entityId: string } }>(
    '/api/vtt/export/:entityId',
    async (request: FastifyRequest<{ Params: { entityId: string } }>, reply: FastifyReply) => {
      try {
        const { entityId } = request.params;
        const format = (request.query as any)?.format || 'generic';
        const payload = await vttService.buildEntity(entityId, format);

        if (!payload) {
          return reply.status(404).send({ error: 'Entity not found' });
        }

        return reply.send(payload);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to export entity',
          details: error.message,
        });
      }
    }
  );
}
