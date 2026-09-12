import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { prisma } from '../services/database.service';
import { s3Service } from '../services/s3.service';
import { FilePreviewService } from '../services/file-preview.service';
import {
  CreateDocumentSchema,
  UpdateDocumentSchema,
  ListDocumentsQuerySchema,
  BulkCreateDocumentSchema,
  CreateDocumentInput,
  UpdateDocumentInput,
  ListDocumentsQuery,
  BulkCreateDocumentInput,
} from '../types/document';

export async function documentRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/documents - Create document and get signed upload URL
   */
  fastify.post<{ Body: CreateDocumentInput }>(
    '/api/documents',
    async (request: FastifyRequest<{ Body: CreateDocumentInput }>, reply: FastifyReply) => {
      try {
        const data = CreateDocumentSchema.parse(request.body);

        // Generate unique storage key
        const fileExtension = data.fileName.split('.').pop() || data.format;
        const storageKey = `documents/${randomUUID()}.${fileExtension}`;

        // Use provided uploadedBy as the userId (caller must supply a valid user id)
        const uploader = await prisma.user.findUnique({ where: { id: data.uploadedBy } });

        // Create database record
        const document = await prisma.document.create({
          data: {
            title: data.title,
            description: data.description,
            type: data.type,
            format: data.format,
            storageKey,
            fileSize: data.fileSize,
            author: data.author,
            uploadedBy: data.uploadedBy,
            uploadedById: uploader ? data.uploadedBy : undefined,
            tags: data.tags,
            collections: data.collections,
            campaigns: data.campaigns,
            isPublic: data.isPublic,
            metadata: data.metadata as any,
          },
        });

        // Generate signed upload URL
        const contentType = getContentType(data.format);
        const uploadUrl = await s3Service.getUploadUrl(storageKey, contentType);

        return reply.status(201).send({
          document,
          uploadUrl,
          expiresIn: 3600,
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(400).send({
          error: 'Invalid request',
          details: error.message,
        });
      }
    }
  );

  /**
   * POST /api/documents/bulk - Create multiple documents and get signed upload URLs
   */
  fastify.post<{ Body: BulkCreateDocumentInput }>(
    '/api/documents/bulk',
    async (request: FastifyRequest<{ Body: BulkCreateDocumentInput }>, reply: FastifyReply) => {
      try {
        const data = BulkCreateDocumentSchema.parse(request.body);
        const batchId = data.batchId || randomUUID();
        const results = [];

        for (const docData of data.documents) {
          try {
            // Generate unique storage key
            const fileExtension = docData.fileName.split('.').pop() || docData.format;
            const storageKey = `documents/${randomUUID()}.${fileExtension}`;

            const uploader = await prisma.user.findUnique({ where: { id: docData.uploadedBy } });

            // Create database record
            const document = await prisma.document.create({
              data: {
                title: docData.title,
                description: docData.description,
                type: docData.type,
                format: docData.format,
            storageKey,
            fileSize: docData.fileSize,
            author: docData.author,
                uploadedBy: docData.uploadedBy,
                uploadedById: uploader ? docData.uploadedBy : undefined,
            tags: docData.tags,
            collections: docData.collections,
            campaigns: docData.campaigns,
            isPublic: docData.isPublic,
            metadata: { ...docData.metadata, batchId },
              },
            });

            // Generate signed upload URL
            const contentType = getContentType(docData.format);
            const uploadUrl = await s3Service.getUploadUrl(storageKey, contentType);

            results.push({
              document,
              uploadUrl,
              expiresIn: 3600,
              success: true,
            });
          } catch (docError: any) {
            results.push({
              error: docError.message,
              fileName: docData.fileName,
              success: false,
            });
          }
        }

        return reply.status(201).send({
          batchId,
          results,
          total: data.documents.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(400).send({
          error: 'Invalid bulk request',
          details: error.message,
        });
      }
    }
  );

  /**
   * GET /api/documents/bulk/:batchId/status - Get bulk upload status
   */
  fastify.get(
    '/api/documents/bulk/:batchId/status',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { batchId } = request.params as { batchId: string };

      try {
        // Get all documents in this batch
        const documents = await prisma.document.findMany({
          where: {
            metadata: {
              path: ['batchId'],
              equals: batchId,
            },
          },
        });

        const total = documents.length;
        const processed = documents.filter(doc => doc.searchIndex !== null).length;
        const failed = documents.filter(doc => doc.ocrStatus === 'failed').length;
        const processing = documents.filter(doc => doc.ocrStatus === 'processing').length;

        return {
          batchId,
          total,
          processed,
          failed,
          processing,
          pending: total - processed - failed - processing,
          documents: documents.map((doc: any) => ({
            id: doc.id,
            title: doc.title,
            status: doc.ocrStatus,
            indexed: doc.searchIndex !== null,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
          })),
        };
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to get bulk status',
          details: error.message,
        });
      }
    }
  );

  /**
   * POST /api/documents/:id/preview - Generate file preview
   */
  fastify.post(
    '/api/documents/:id/preview',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const options = request.body as { generateThumbnail?: boolean; thumbnailSize?: number };

      try {
        // Get document
        const document = await prisma.document.findUnique({
          where: { id },
        });

        if (!document) {
          return reply.status(404).send({ error: 'Document not found' });
        }

        // Generate preview
        const preview = await FilePreviewService.generatePreview(document.storageKey, options);

        // Update document with preview metadata
        await prisma.document.update({
          where: { id },
          data: {
            metadata: {
              ...(document.metadata as object || {}),
              preview: preview as any,
            },
          },
        });

        return reply.send(preview);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to generate preview',
          details: error.message,
        });
      }
    }
  );

  /**
   * GET /api/documents/:id/preview - Get existing file preview
   */
  fastify.get(
    '/api/documents/:id/preview',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        // Get document with preview metadata
        const document = await prisma.document.findUnique({
          where: { id },
          select: {
            id: true,
            metadata: true,
          },
        });

        if (!document) {
          return reply.status(404).send({ error: 'Document not found' });
        }

        const preview = (document.metadata as any)?.preview;
        if (!preview) {
          return reply.status(404).send({ error: 'Preview not available' });
        }

        return reply.send(preview);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to get preview',
          details: error.message,
        });
      }
    }
  );

  /**
   * GET /api/documents - List documents with filtering
   */
  fastify.get<{ Querystring: ListDocumentsQuery }>(
    '/api/documents',
    { preHandler: fastify.authenticate },
    async (request: FastifyRequest<{ Querystring: ListDocumentsQuery }>, reply: FastifyReply) => {
      try {
        const query = ListDocumentsQuerySchema.parse(request.query);

        const where: any = {};

        if (query.type) {
          where.type = query.type;
        }

        if (query.campaign) {
          where.campaigns = {
            has: query.campaign,
          };
        }

        if (query.tag) {
          where.tags = {
            has: query.tag,
          };
        }

        if (query.search) {
          where.OR = [
            { title: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
          ];
        }

        const [documents, total] = await Promise.all([
          prisma.document.findMany({
            where,
            skip: query.skip,
            take: query.limit,
            orderBy: { uploadedAt: 'desc' },
          }),
          prisma.document.count({ where }),
        ]);

        return reply.send({
          documents,
          pagination: {
            total,
            skip: query.skip,
            limit: query.limit,
          },
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(400).send({
          error: 'Invalid query parameters',
          details: error.message,
        });
      }
    }
  );

  /**
   * GET /api/documents/:id - Get document metadata
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/documents/:id',
    { preHandler: fastify.authenticate },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const document = await prisma.document.findUnique({
          where: { id: request.params.id },
        });

        if (!document) {
          return reply.status(404).send({ error: 'Document not found' });
        }

        return reply.send(document);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * GET /api/documents/:id/content - Stream document content
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/documents/:id/content',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const document = await prisma.document.findUnique({
          where: { id: request.params.id },
        });

        if (!document) {
          return reply.status(404).send({ error: 'Document not found' });
        }

        const range = request.headers.range;

        // Get object from S3 with optional Range header
        const s3Object = await s3Service.getObject(document.storageKey, range);

        // Set content type
        const contentType = getContentType(document.format);
        reply.header('Content-Type', contentType);
        reply.header('Accept-Ranges', 'bytes');

        // Handle Range requests
        if (range && s3Object.ContentRange) {
          reply.status(206);
          reply.header('Content-Range', s3Object.ContentRange);
          reply.header('Content-Length', s3Object.ContentLength?.toString() || '0');
        } else {
          reply.header('Content-Length', document.fileSize.toString());
        }

        // Stream the response
        if (s3Object.Body) {
          return reply.send(s3Object.Body as Readable);
        }

        return reply.status(500).send({ error: 'Failed to retrieve document content' });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * GET /api/documents/:id/page-images - Get page image URLs for reader
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/documents/:id/page-images',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const document = await prisma.document.findUnique({
          where: { id: request.params.id },
          select: {
            id: true,
            title: true,
            metadata: true,
          },
        });

        if (!document) {
          return reply.status(404).send({ error: 'Document not found' });
        }

        const pageImages = (document.metadata as any)?.pageImages || [];
        if (!Array.isArray(pageImages) || pageImages.length === 0) {
          return reply.status(404).send({ error: 'No page images available' });
        }

        const pages = await Promise.all(
          pageImages.map(async (key: string) => {
            const match = key.match(/page-(\d+)\.webp$/);
            const pageNumber = match ? parseInt(match[1], 10) : null;
            const url = await s3Service.getDownloadUrl(key);
            return { key, url, pageNumber };
          })
        );

        pages.sort((a, b) => {
          if (a.pageNumber === null && b.pageNumber === null) return 0;
          if (a.pageNumber === null) return 1;
          if (b.pageNumber === null) return -1;
          return a.pageNumber - b.pageNumber;
        });

        return reply.send({
          documentId: document.id,
          title: document.title,
          count: pages.length,
          pages,
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to load page images' });
      }
    }
  );

  /**
   * PUT /api/documents/:id - Update document metadata
   */
  fastify.put<{ Params: { id: string }; Body: UpdateDocumentInput }>(
    '/api/documents/:id',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateDocumentInput }>,
      reply: FastifyReply
    ) => {
      try {
        const data = UpdateDocumentSchema.parse(request.body);

        const document = await prisma.document.update({
          where: { id: request.params.id },
          data: data as any,
        });

        return reply.send(document);
      } catch (error: any) {
        fastify.log.error(error);

        if (error.code === 'P2025') {
          return reply.status(404).send({ error: 'Document not found' });
        }

        return reply.status(400).send({
          error: 'Invalid request',
          details: error.message,
        });
      }
    }
  );

  /**
   * DELETE /api/documents/:id - Delete document
   */
  fastify.delete<{ Params: { id: string } }>(
    '/api/documents/:id',
    { preHandler: fastify.authenticate },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const document = await prisma.document.findUnique({
          where: { id: request.params.id },
        });

        if (!document) {
          return reply.status(404).send({ error: 'Document not found' });
        }

        // Delete from S3
        await s3Service.deleteObject(document.storageKey);

        // Delete thumbnail if exists
        if (document.thumbnailKey) {
          await s3Service.deleteObject(document.thumbnailKey);
        }

        // Delete from database
        await prisma.document.delete({
          where: { id: request.params.id },
        });

        return reply.status(204).send();
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );
}

/**
 * Helper function to get content type from document format
 */
function getContentType(format: string): string {
  const contentTypes: Record<string, string> = {
    pdf: 'application/pdf',
    markdown: 'text/markdown',
    html: 'text/html',
  };

  return contentTypes[format] || 'application/octet-stream';
}
