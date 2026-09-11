import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../services/database.service';
import {
  CreateReferenceSchema,
  UpdateReferenceSchema,
  ListReferencesQuerySchema,
  CreateReferenceInput,
  UpdateReferenceInput,
  ListReferencesQuery,
} from '../types/reference';

export async function referenceRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/references - Create a new reference/bookmark
   */
  fastify.post<{ Body: CreateReferenceInput }>(
    '/api/references',
    async (request: FastifyRequest<{ Body: CreateReferenceInput }>, reply: FastifyReply) => {
      try {
        const data = CreateReferenceSchema.parse(request.body);

        // Verify document exists
        const document = await prisma.document.findUnique({
          where: { id: data.documentId },
        });

        if (!document) {
          return reply.status(404).send({ error: 'Document not found' });
        }

        const reference = await prisma.documentReference.create({
          data: {
            documentId: data.documentId,
            userId: data.userId,
            campaignId: data.campaignId,
            pageNumber: data.pageNumber,
            section: data.section,
            textSelection: data.textSelection as any,
            title: data.title,
            notes: data.notes,
            tags: data.tags,
            color: data.color,
            isShared: data.isShared,
          },
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

        return reply.status(201).send(reference);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(400).send({
          error: 'Failed to create reference',
          details: error.message,
        });
      }
    }
  );

  /**
   * GET /api/references - List references with filtering
   */
  fastify.get<{ Querystring: ListReferencesQuery }>(
    '/api/references',
    async (request: FastifyRequest<{ Querystring: ListReferencesQuery }>, reply: FastifyReply) => {
      try {
        const query = ListReferencesQuerySchema.parse(request.query);

        const where: any = {};

        if (query.documentId) {
          where.documentId = query.documentId;
        }

        if (query.userId) {
          where.userId = query.userId;
        }

        if (query.campaignId) {
          where.campaignId = query.campaignId;
        }

        const [references, total] = await Promise.all([
          prisma.documentReference.findMany({
            where,
            skip: query.skip,
            take: query.limit,
            orderBy: { createdAt: 'desc' },
            include: {
              document: {
                select: {
                  id: true,
                  title: true,
                  type: true,
                },
              },
            },
          }),
          prisma.documentReference.count({ where }),
        ]);

        return reply.send({
          references,
          pagination: {
            total,
            skip: query.skip,
            limit: query.limit,
          },
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(400).send({
          error: 'Failed to list references',
          details: error.message,
        });
      }
    }
  );

  /**
   * GET /api/references/:id - Get a specific reference
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/references/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const reference = await prisma.documentReference.findUnique({
          where: { id: request.params.id },
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

        if (!reference) {
          return reply.status(404).send({ error: 'Reference not found' });
        }

        // Update last accessed
        await prisma.documentReference.update({
          where: { id: request.params.id },
          data: { lastAccessed: new Date() },
        });

        return reply.send(reference);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * PUT /api/references/:id - Update a reference
   */
  fastify.put<{ Params: { id: string }; Body: UpdateReferenceInput }>(
    '/api/references/:id',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateReferenceInput }>,
      reply: FastifyReply
    ) => {
      try {
        const data = UpdateReferenceSchema.parse(request.body);

        const reference = await prisma.documentReference.update({
          where: { id: request.params.id },
          data,
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

        return reply.send(reference);
      } catch (error: any) {
        fastify.log.error(error);

        if (error.code === 'P2025') {
          return reply.status(404).send({ error: 'Reference not found' });
        }

        return reply.status(400).send({
          error: 'Failed to update reference',
          details: error.message,
        });
      }
    }
  );

  /**
   * DELETE /api/references/:id - Delete a reference
   */
  fastify.delete<{ Params: { id: string } }>(
    '/api/references/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        await prisma.documentReference.delete({
          where: { id: request.params.id },
        });

        return reply.status(204).send();
      } catch (error: any) {
        fastify.log.error(error);

        if (error.code === 'P2025') {
          return reply.status(404).send({ error: 'Reference not found' });
        }

        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );
}
