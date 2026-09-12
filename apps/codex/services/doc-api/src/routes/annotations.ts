import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../services/database.service';
import {
  CreateAnnotationSchema,
  CreateAnnotationInput,
  UpdateAnnotationSchema,
  UpdateAnnotationInput,
} from '../types/annotation';

/**
 * Register annotation routes
 */
export async function annotationRoutes(fastify: FastifyInstance) {
  /**
   * Get all annotations for a document
   */
  fastify.get(
    '/api/documents/:id/annotations',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: { userId?: string; campaignId?: string; pageNumber?: string; type?: string; isShared?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { id: documentId } = request.params;
      const { userId, campaignId, pageNumber, type, isShared } = request.query;

      try {
        const annotations = await prisma.documentAnnotation.findMany({
          where: {
            documentId,
            ...(userId && { userId }),
            ...(campaignId && { campaignId }),
            ...(pageNumber && { pageNumber: parseInt(pageNumber) }),
            ...(type && { type: type as any }),
            ...(isShared !== undefined && { isShared: isShared === 'true' }),
          },
          orderBy: [{ pageNumber: 'asc' }, { createdAt: 'desc' }],
        });

        return reply.send(annotations);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to fetch annotations' });
      }
    }
  );

  /**
   * Create a new annotation
   */
  fastify.post(
    '/api/documents/:id/annotations',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: CreateAnnotationInput;
      }>,
      reply: FastifyReply
    ) => {
      const { id: documentId } = request.params;
      const body = request.body;

      try {
        // Validate input
        const validated = CreateAnnotationSchema.parse({
          ...body,
          documentId,
        });

        // Check if document exists
        const document = await prisma.document.findUnique({
          where: { id: documentId },
        });

        if (!document) {
          return reply.status(404).send({ error: 'Document not found' });
        }

        // If referenceId provided, check if it exists
        if (validated.referenceId) {
          const reference = await prisma.documentReference.findUnique({
            where: { id: validated.referenceId },
          });

          if (!reference) {
            return reply.status(404).send({ error: 'Reference not found' });
          }
        }

        // Create annotation
        const annotation = await prisma.documentAnnotation.create({
          data: {
            documentId: validated.documentId,
            referenceId: validated.referenceId || null,
            userId: validated.userId,
            campaignId: validated.campaignId || null,
            pageNumber: validated.pageNumber,
            position: validated.position,
            type: validated.type,
            content: validated.content,
            color: validated.color,
            isShared: validated.isShared,
          },
        });

        return reply.status(201).send(annotation);
      } catch (error: any) {
        fastify.log.error(error);

        if (error.name === 'ZodError') {
          return reply.status(400).send({ error: 'Invalid input', details: error.errors });
        }

        return reply.status(500).send({ error: 'Failed to create annotation' });
      }
    }
  );

  /**
   * Get a specific annotation
   */
  fastify.get(
    '/api/annotations/:id',
    async (
      request: FastifyRequest<{
        Params: { id: string };
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;

      try {
        const annotation = await prisma.documentAnnotation.findUnique({
          where: { id },
          include: {
            document: {
              select: {
                id: true,
                title: true,
              },
            },
            reference: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        });

        if (!annotation) {
          return reply.status(404).send({ error: 'Annotation not found' });
        }

        return reply.send(annotation);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to fetch annotation' });
      }
    }
  );

  /**
   * Update an annotation
   */
  fastify.put(
    '/api/annotations/:id',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: UpdateAnnotationInput;
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const body = request.body;

      try {
        // Validate input
        const validated = UpdateAnnotationSchema.parse(body);

        // Check if annotation exists
        const existing = await prisma.documentAnnotation.findUnique({
          where: { id },
        });

        if (!existing) {
          return reply.status(404).send({ error: 'Annotation not found' });
        }

        // Update annotation
        const annotation = await prisma.documentAnnotation.update({
          where: { id },
          data: {
            ...(validated.content !== undefined && { content: validated.content }),
            ...(validated.color !== undefined && { color: validated.color }),
            ...(validated.position !== undefined && { position: validated.position }),
            ...(validated.isShared !== undefined && { isShared: validated.isShared }),
          },
        });

        return reply.send(annotation);
      } catch (error: any) {
        fastify.log.error(error);

        if (error.name === 'ZodError') {
          return reply.status(400).send({ error: 'Invalid input', details: error.errors });
        }

        return reply.status(500).send({ error: 'Failed to update annotation' });
      }
    }
  );

  /**
   * Delete an annotation
   */
  fastify.delete(
    '/api/annotations/:id',
    async (
      request: FastifyRequest<{
        Params: { id: string };
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;

      try {
        // Check if annotation exists
        const annotation = await prisma.documentAnnotation.findUnique({
          where: { id },
        });

        if (!annotation) {
          return reply.status(404).send({ error: 'Annotation not found' });
        }

        // Delete annotation
        await prisma.documentAnnotation.delete({
          where: { id },
        });

        return reply.status(204).send();
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to delete annotation' });
      }
    }
  );

  /**
   * Get all annotations (with filtering)
   */
  fastify.get(
    '/api/annotations',
    async (
      request: FastifyRequest<{
        Querystring: {
          documentId?: string;
          userId?: string;
          campaignId?: string;
          pageNumber?: string;
          type?: string;
          isShared?: string;
          limit?: string;
          offset?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { documentId, userId, campaignId, pageNumber, type, isShared, limit, offset } = request.query;

      try {
        const annotations = await prisma.documentAnnotation.findMany({
          where: {
            ...(documentId && { documentId }),
            ...(userId && { userId }),
            ...(campaignId && { campaignId }),
            ...(pageNumber && { pageNumber: parseInt(pageNumber) }),
            ...(type && { type: type as any }),
            ...(isShared !== undefined && { isShared: isShared === 'true' }),
          },
          take: limit ? parseInt(limit) : 50,
          skip: offset ? parseInt(offset) : 0,
          orderBy: [{ createdAt: 'desc' }],
          include: {
            document: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        });

        return reply.send(annotations);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to fetch annotations' });
      }
    }
  );
}
