import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../services/database.service';

/**
 * Register structured data routes
 */
export async function structuredDataRoutes(fastify: FastifyInstance) {
  /**
   * Get all structured data for a document
   */
  fastify.get(
    '/api/documents/:id/structured-data',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: { type?: string; name?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { id: documentId } = request.params;
      const { type, name } = request.query;

      try {
        const structuredData = await prisma.structuredData.findMany({
          where: {
            documentId,
            ...(type && { type: type as any }),
            ...(name && { name: { contains: name, mode: 'insensitive' as any } }),
          },
          orderBy: [{ pageNumber: 'asc' }, { name: 'asc' }],
        });

        return reply.send(structuredData);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to fetch structured data' });
      }
    }
  );

  /**
   * Get specific structured data entry
   */
  fastify.get(
    '/api/structured-data/:id',
    async (
      request: FastifyRequest<{
        Params: { id: string };
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;

      try {
        const data = await prisma.structuredData.findUnique({
          where: { id },
          include: {
            document: {
              select: {
                id: true,
                title: true,
                type: true,
              },
            },
          },
        });

        if (!data) {
          return reply.status(404).send({ error: 'Structured data not found' });
        }

        return reply.send(data);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to fetch structured data' });
      }
    }
  );

  /**
   * List all structured data with filtering
   */
  fastify.get(
    '/api/structured-data',
    async (
      request: FastifyRequest<{
        Querystring: {
          documentId?: string;
          type?: string;
          name?: string;
          search?: string;
          limit?: string;
          offset?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { documentId, type, name, search, limit, offset } = request.query;

      try {
        const structuredData = await prisma.structuredData.findMany({
          where: {
            ...(documentId && { documentId }),
            ...(type && { type: type as any }),
            ...(name && { name: { contains: name, mode: 'insensitive' as any } }),
            ...(search && { searchText: { contains: search, mode: 'insensitive' as any } }),
          },
          take: limit ? parseInt(limit) : 50,
          skip: offset ? parseInt(offset) : 0,
          orderBy: [{ name: 'asc' }],
          include: {
            document: {
              select: {
                id: true,
                title: true,
                type: true,
              },
            },
          },
        });

        return reply.send(structuredData);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to fetch structured data' });
      }
    }
  );

  /**
   * Delete structured data entry
   */
  fastify.delete(
    '/api/structured-data/:id',
    async (
      request: FastifyRequest<{
        Params: { id: string };
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;

      try {
        // Check if exists
        const data = await prisma.structuredData.findUnique({
          where: { id },
        });

        if (!data) {
          return reply.status(404).send({ error: 'Structured data not found' });
        }

        // Delete
        await prisma.structuredData.delete({
          where: { id },
        });

        return reply.status(204).send();
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to delete structured data' });
      }
    }
  );
}
