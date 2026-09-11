import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../../services/database.service';
import { elasticService } from '../../services/elastic.service';
import {
  buildProcessingIssues,
  buildProcessingSummary,
  ProcessingDocumentSnapshot,
} from '../../services/processing-quality.service';

export async function adminProcessingRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/admin/processing/summary - Processing quality summary
   */
  fastify.get('/api/admin/processing/summary', async (_request, reply: FastifyReply) => {
    try {
      const documents = await prisma.document.findMany({
        select: {
          id: true,
          title: true,
          ocrStatus: true,
          searchIndex: true,
          pageCount: true,
          metadata: true,
        },
      });
      const summary = buildProcessingSummary(documents as ProcessingDocumentSnapshot[]);
      return reply.send(summary);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Failed to get processing summary',
        details: error.message,
      });
    }
  });

  /**
   * GET /api/admin/processing/issues - List processing quality issues
   */
  fastify.get('/api/admin/processing/issues', async (_request, reply: FastifyReply) => {
    try {
      const documents = await prisma.document.findMany({
        select: {
          id: true,
          title: true,
          ocrStatus: true,
          searchIndex: true,
          pageCount: true,
          metadata: true,
        },
      });
      const issues = buildProcessingIssues(documents as ProcessingDocumentSnapshot[]);

      return reply.send({
        issues,
        total: issues.length,
        summary: {
          errors: issues.filter(issue => issue.severity === 'error').length,
          warnings: issues.filter(issue => issue.severity === 'warning').length,
        },
        byType: issues.reduce((acc, issue) => {
          acc[issue.type] = (acc[issue.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Failed to get processing issues',
        details: error.message,
      });
    }
  });

  /**
   * GET /api/admin/processing/report/:id - Get processing report for a document
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/admin/processing/report/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const document = await prisma.document.findUnique({
          where: { id: request.params.id },
          select: {
            id: true,
            title: true,
            description: true,
            type: true,
            format: true,
            fileSize: true,
            pageCount: true,
            ocrStatus: true,
            searchIndex: true,
            uploadedAt: true,
            lastModified: true,
            metadata: true,
          },
        });

        if (!document) {
          return reply.status(404).send({ error: 'Document not found' });
        }

        const processing = (document.metadata as any)?.processing || {};
        const preview = (document.metadata as any)?.preview || {};

        return reply.send({
          document: {
            id: document.id,
            title: document.title,
            description: document.description,
            type: document.type,
            format: document.format,
            fileSize: document.fileSize,
            pageCount: document.pageCount,
            ocrStatus: document.ocrStatus,
            searchIndex: document.searchIndex,
            uploadedAt: document.uploadedAt,
            lastModified: document.lastModified,
          },
          processing,
          preview,
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to get processing report',
          details: error.message,
        });
      }
    }
  );

  /**
   * GET /api/admin/processing/search-check/:id - Search within a document
   */
  fastify.get<{ Params: { id: string }; Querystring: { q?: string } }>(
    '/api/admin/processing/search-check/:id',
    async (request: FastifyRequest<{ Params: { id: string }; Querystring: { q?: string } }>, reply: FastifyReply) => {
      const query = request.query.q?.trim();
      if (!query) {
        return reply.status(400).send({ error: 'Missing query parameter q' });
      }

      try {
        const exists = await elasticService.documentExists(request.params.id);
        if (!exists) {
          return reply.status(404).send({ error: 'Document not indexed' });
        }

        const results = await elasticService.searchWithinDocument({
          documentId: request.params.id,
          query,
          size: 5,
        });

        return reply.send({
          documentId: request.params.id,
          query,
          total: results.total,
          hits: results.hits,
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to run document search check',
          details: error.message,
        });
      }
    }
  );
}
