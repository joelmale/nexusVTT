import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../services/database.service';
import { enqueueDocumentProcessing } from '../services/queue.service';

export async function processingRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/documents/:id/process - Trigger document processing
   */
  fastify.post<{ Params: { id: string } }>(
    '/api/documents/:id/process',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const documentId = request.params.id;

        // Verify document exists
        const document = await prisma.document.findUnique({
          where: { id: documentId },
        });

        if (!document) {
          return reply.status(404).send({ error: 'Document not found' });
        }

        // Check if already processed or processing
        if (document.ocrStatus === 'completed') {
          return reply.status(400).send({
            error: 'Document already processed',
            ocrStatus: document.ocrStatus,
          });
        }

        if (document.ocrStatus === 'processing') {
          return reply.status(400).send({
            error: 'Document is currently being processed',
            ocrStatus: document.ocrStatus,
          });
        }

        // Enqueue processing job
        const jobId = await enqueueDocumentProcessing(documentId);

        // Update document status
        await prisma.document.update({
          where: { id: documentId },
          data: { ocrStatus: 'pending' },
        });

        return reply.status(202).send({
          message: 'Document processing queued',
          documentId,
          jobId,
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to queue document processing' });
      }
    }
  );

  /**
   * GET /api/documents/:id/processing-status - Get processing status
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/documents/:id/processing-status',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const document = await prisma.document.findUnique({
          where: { id: request.params.id },
          select: {
            id: true,
            ocrStatus: true,
            pageCount: true,
            thumbnailKey: true,
            searchIndex: true,
            metadata: true,
          },
        });

        if (!document) {
          return reply.status(404).send({ error: 'Document not found' });
        }

        return reply.send({
          documentId: document.id,
          status: document.ocrStatus,
          processed: document.ocrStatus === 'completed',
          pageCount: document.pageCount,
          hasThumbnail: !!document.thumbnailKey,
          isIndexed: !!document.searchIndex,
          processing: (document.metadata as any)?.processing || {},
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to get processing status' });
      }
    }
  );
}
