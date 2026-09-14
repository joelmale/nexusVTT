import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../services/database.service';
import { s3Service } from '../../services/s3.service';
import { enqueueDocumentProcessing } from '../../services/queue.service';

interface ValidationIssue {
  id: string;
  type: string;
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  autoFixable: boolean;
  documentId?: string;
  documentTitle?: string;
}

export async function adminValidationRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/admin/validation/issues - Find all data quality issues
   */
  fastify.get(
    '/api/admin/validation/issues',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const issues: ValidationIssue[] = [];

        // 1. Documents with missing titles
        const docsWithoutTitle = await prisma.document.findMany({
          where: {
            title: '',
          },
          select: { id: true, storageKey: true },
        });

        for (const doc of docsWithoutTitle) {
          issues.push({
            id: `missing-title-${doc.id}`,
            type: 'missing_title',
            severity: 'warning',
            title: 'Document missing title',
            description: `Document has no title. Storage key: ${doc.storageKey}`,
            autoFixable: true,
            documentId: doc.id,
          });
        }

        // 2. Documents with no tags
        const docsWithoutTags = await prisma.document.findMany({
          where: {
            tags: { isEmpty: true },
          },
          select: { id: true, title: true, type: true },
          take: 100, // Limit to avoid overload
        });

        for (const doc of docsWithoutTags) {
          issues.push({
            id: `no-tags-${doc.id}`,
            type: 'no_tags',
            severity: 'info',
            title: 'Document has no tags',
            description: `Document "${doc.title}" has no tags assigned`,
            autoFixable: true,
            documentId: doc.id,
            documentTitle: doc.title,
          });
        }

        // 3. Documents with failed processing but not retried recently
        const failedDocs = await prisma.document.findMany({
          where: {
            ocrStatus: 'failed',
          },
          select: {
            id: true,
            title: true,
            uploadedAt: true,
            lastModified: true,
          },
        });

        for (const doc of failedDocs) {
          // Check if it's been more than 1 day since last modified
          const daysSinceModified = (Date.now() - new Date(doc.lastModified).getTime()) / (1000 * 60 * 60 * 24);

          if (daysSinceModified > 1) {
            issues.push({
              id: `failed-processing-${doc.id}`,
              type: 'failed_processing',
              severity: 'error',
              title: 'Failed document not retried',
              description: `Document "${doc.title}" failed processing ${Math.floor(daysSinceModified)} days ago`,
              autoFixable: true,
              documentId: doc.id,
              documentTitle: doc.title,
            });
          }
        }

        // 4. Documents stuck in processing
        const stuckDocs = await prisma.document.findMany({
          where: {
            ocrStatus: 'processing',
          },
          select: {
            id: true,
            title: true,
            uploadedAt: true,
          },
        });

        for (const doc of stuckDocs) {
          const hoursSinceUpload = (Date.now() - new Date(doc.uploadedAt).getTime()) / (1000 * 60 * 60);

          if (hoursSinceUpload > 1) {
            issues.push({
              id: `stuck-processing-${doc.id}`,
              type: 'stuck_processing',
              severity: 'error',
              title: 'Document stuck in processing',
              description: `Document "${doc.title}" has been processing for ${Math.floor(hoursSinceUpload)} hours`,
              autoFixable: true,
              documentId: doc.id,
              documentTitle: doc.title,
            });
          }
        }

        // 5. Documents with invalid file sizes
        const invalidSizeDocs = await prisma.document.findMany({
          where: {
            fileSize: { lte: 0 },
          },
          select: {
            id: true,
            title: true,
            fileSize: true,
            storageKey: true,
          },
        });

        for (const doc of invalidSizeDocs) {
          issues.push({
            id: `invalid-size-${doc.id}`,
            type: 'invalid_file_size',
            severity: 'warning',
            title: 'Invalid file size',
            description: `Document "${doc.title}" has file size: ${doc.fileSize}`,
            autoFixable: true,
            documentId: doc.id,
            documentTitle: doc.title,
          });
        }

        // 6. Completed documents without search index
        const docsWithoutIndex = await prisma.document.findMany({
          where: {
            ocrStatus: 'completed',
            searchIndex: null,
          },
          select: {
            id: true,
            title: true,
          },
          take: 50,
        });

        for (const doc of docsWithoutIndex) {
          issues.push({
            id: `missing-index-${doc.id}`,
            type: 'missing_search_index',
            severity: 'warning',
            title: 'Completed document missing search index',
            description: `Document "${doc.title}" is marked completed but has no search index`,
            autoFixable: true,
            documentId: doc.id,
            documentTitle: doc.title,
          });
        }

        // 7. Documents with duplicate titles
        const duplicateTitles = await prisma.$queryRaw<Array<{ title: string; count: number }>>`
          SELECT title, COUNT(*) as count
          FROM documents
          WHERE title != ''
          GROUP BY title
          HAVING COUNT(*) > 1
          ORDER BY count DESC
          LIMIT 20
        `;

        for (const dup of duplicateTitles) {
          issues.push({
            id: `duplicate-title-${dup.title}`,
            type: 'duplicate_title',
            severity: 'info',
            title: 'Duplicate document titles',
            description: `${Number(dup.count)} documents share the title "${dup.title}"`,
            autoFixable: false,
          });
        }

        return reply.send({
          issues,
          total: issues.length,
          summary: {
            errors: issues.filter(i => i.severity === 'error').length,
            warnings: issues.filter(i => i.severity === 'warning').length,
            info: issues.filter(i => i.severity === 'info').length,
            autoFixable: issues.filter(i => i.autoFixable).length,
          },
          byType: issues.reduce((acc, issue) => {
            acc[issue.type] = (acc[issue.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to check for issues',
          details: error.message,
        });
      }
    }
  );

  /**
   * POST /api/admin/validation/fix - Auto-fix common issues
   */
  fastify.post<{ Body: { issueIds?: string[]; issueTypes?: string[]; dryRun?: boolean } }>(
    '/api/admin/validation/fix',
    async (request: FastifyRequest<{ Body: { issueIds?: string[]; issueTypes?: string[]; dryRun?: boolean } }>, reply: FastifyReply) => {
      try {
        const { issueIds, issueTypes, dryRun = false } = request.body || {};

        const results = {
          fixed: [] as Array<{ issueId: string; type: string; description: string }>,
          failed: [] as Array<{ issueId: string; type: string; error: string }>,
        };

        // Helper function to determine if we should fix this issue
        const shouldFix = (issueId: string, issueType: string) => {
          if (issueIds && issueIds.length > 0) {
            return issueIds.includes(issueId);
          }
          if (issueTypes && issueTypes.length > 0) {
            return issueTypes.includes(issueType);
          }
          return false; // Default to not fixing if no filters provided
        };

        // 1. Fix missing titles
        if (shouldFix('missing-title', 'missing_title') || issueTypes?.includes('missing_title')) {
          const docsWithoutTitle = await prisma.document.findMany({
            where: {
              title: '',
            },
            select: { id: true, storageKey: true, format: true },
          });

          for (const doc of docsWithoutTitle) {
            try {
              // Generate title from storage key
              const fileName = doc.storageKey.split('/').pop() || 'Untitled Document';
              const title = fileName.replace(/\.[^/.]+$/, ''); // Remove extension

              if (!dryRun) {
                await prisma.document.update({
                  where: { id: doc.id },
                  data: { title },
                });
              }

              results.fixed.push({
                issueId: `missing-title-${doc.id}`,
                type: 'missing_title',
                description: `Set title to "${title}"`,
              });
            } catch (error: any) {
              results.failed.push({
                issueId: `missing-title-${doc.id}`,
                type: 'missing_title',
                error: error.message,
              });
            }
          }
        }

        // 2. Fix documents with no tags (add default tag based on type)
        if (shouldFix('no-tags', 'no_tags') || issueTypes?.includes('no_tags')) {
          const docsWithoutTags = await prisma.document.findMany({
            where: { tags: { isEmpty: true } },
            select: { id: true, title: true, type: true },
            take: 100,
          });

          for (const doc of docsWithoutTags) {
            try {
              const defaultTag = `${doc.type}_uncategorized`;

              if (!dryRun) {
                await prisma.document.update({
                  where: { id: doc.id },
                  data: { tags: [defaultTag] },
                });
              }

              results.fixed.push({
                issueId: `no-tags-${doc.id}`,
                type: 'no_tags',
                description: `Added default tag "${defaultTag}"`,
              });
            } catch (error: any) {
              results.failed.push({
                issueId: `no-tags-${doc.id}`,
                type: 'no_tags',
                error: error.message,
              });
            }
          }
        }

        // 3. Retry failed documents
        if (shouldFix('failed-processing', 'failed_processing') || issueTypes?.includes('failed_processing')) {
          const failedDocs = await prisma.document.findMany({
            where: { ocrStatus: 'failed' },
            select: { id: true, title: true },
            take: 10, // Limit retries to avoid queue overload
          });

          for (const doc of failedDocs) {
            try {
              if (!dryRun) {
                await enqueueDocumentProcessing(doc.id);
                await prisma.document.update({
                  where: { id: doc.id },
                  data: { ocrStatus: 'pending' },
                });
              }

              results.fixed.push({
                issueId: `failed-processing-${doc.id}`,
                type: 'failed_processing',
                description: `Requeued document for processing`,
              });
            } catch (error: any) {
              results.failed.push({
                issueId: `failed-processing-${doc.id}`,
                type: 'failed_processing',
                error: error.message,
              });
            }
          }
        }

        // 4. Reset stuck documents
        if (shouldFix('stuck-processing', 'stuck_processing') || issueTypes?.includes('stuck_processing')) {
          const stuckDocs = await prisma.document.findMany({
            where: { ocrStatus: 'processing' },
            select: { id: true, title: true, uploadedAt: true },
          });

          for (const doc of stuckDocs) {
            const hoursSinceUpload = (Date.now() - new Date(doc.uploadedAt).getTime()) / (1000 * 60 * 60);

            if (hoursSinceUpload > 1) {
              try {
                if (!dryRun) {
                  await enqueueDocumentProcessing(doc.id);
                  await prisma.document.update({
                    where: { id: doc.id },
                    data: { ocrStatus: 'pending' },
                  });
                }

                results.fixed.push({
                  issueId: `stuck-processing-${doc.id}`,
                  type: 'stuck_processing',
                  description: `Reset to pending and requeued`,
                });
              } catch (error: any) {
                results.failed.push({
                  issueId: `stuck-processing-${doc.id}`,
                  type: 'stuck_processing',
                  error: error.message,
                });
              }
            }
          }
        }

        // 5. Fix invalid file sizes
        if (shouldFix('invalid-size', 'invalid_file_size') || issueTypes?.includes('invalid_file_size')) {
          const invalidSizeDocs = await prisma.document.findMany({
            where: { fileSize: { lte: 0 } },
            select: { id: true, storageKey: true },
            take: 50,
          });

          for (const doc of invalidSizeDocs) {
            try {
              if (!dryRun) {
                // Try to get file size from S3
                const s3Object = await s3Service.getObject(doc.storageKey);
                const size = s3Object.ContentLength || 0;

                await prisma.document.update({
                  where: { id: doc.id },
                  data: { fileSize: size },
                });

                results.fixed.push({
                  issueId: `invalid-size-${doc.id}`,
                  type: 'invalid_file_size',
                  description: `Updated file size to ${size} bytes`,
                });
              } else {
                results.fixed.push({
                  issueId: `invalid-size-${doc.id}`,
                  type: 'invalid_file_size',
                  description: `Would fetch file size from S3`,
                });
              }
            } catch (error: any) {
              results.failed.push({
                issueId: `invalid-size-${doc.id}`,
                type: 'invalid_file_size',
                error: error.message,
              });
            }
          }
        }

        // 6. Fix missing search index
        if (shouldFix('missing-index', 'missing_search_index') || issueTypes?.includes('missing_search_index')) {
          const docsWithoutIndex = await prisma.document.findMany({
            where: {
              ocrStatus: 'completed',
              searchIndex: null,
            },
            select: { id: true, title: true },
            take: 20,
          });

          for (const doc of docsWithoutIndex) {
            try {
              if (!dryRun) {
                // Requeue for processing to recreate index
                await enqueueDocumentProcessing(doc.id);
                await prisma.document.update({
                  where: { id: doc.id },
                  data: { ocrStatus: 'pending' },
                });
              }

              results.fixed.push({
                issueId: `missing-index-${doc.id}`,
                type: 'missing_search_index',
                description: `Requeued for reindexing`,
              });
            } catch (error: any) {
              results.failed.push({
                issueId: `missing-index-${doc.id}`,
                type: 'missing_search_index',
                error: error.message,
              });
            }
          }
        }

        return reply.send({
          message: dryRun ? 'Dry run completed' : 'Auto-fix completed',
          dryRun,
          results: {
            fixed: results.fixed.length,
            failed: results.failed.length,
          },
          details: results,
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to fix issues',
          details: error.message,
        });
      }
    }
  );

  /**
   * GET /api/admin/validation/health - Overall system health check
   */
  fastify.get(
    '/api/admin/validation/health',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const [
          totalDocs,
          pendingDocs,
          processingDocs,
          failedDocs,
          completedDocs,
          docsWithoutTags,
          docsWithoutTitle,
        ] = await Promise.all([
          prisma.document.count(),
          prisma.document.count({ where: { ocrStatus: 'pending' } }),
          prisma.document.count({ where: { ocrStatus: 'processing' } }),
          prisma.document.count({ where: { ocrStatus: 'failed' } }),
          prisma.document.count({ where: { ocrStatus: 'completed' } }),
          prisma.document.count({ where: { tags: { isEmpty: true } } }),
          prisma.document.count({ where: { title: '' } }),
        ]);

        const healthScore = totalDocs > 0
          ? Math.round(((completedDocs - failedDocs) / totalDocs) * 100)
          : 100;

        return reply.send({
          healthScore,
          status: healthScore >= 90 ? 'healthy' : healthScore >= 70 ? 'warning' : 'critical',
          metrics: {
            totalDocuments: totalDocs,
            pending: pendingDocs,
            processing: processingDocs,
            failed: failedDocs,
            completed: completedDocs,
            completionRate: totalDocs > 0 ? ((completedDocs / totalDocs) * 100).toFixed(2) + '%' : '0%',
          },
          issues: {
            documentsWithoutTags: docsWithoutTags,
            documentsWithoutTitle: docsWithoutTitle,
            failedDocuments: failedDocs,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to check system health',
          details: error.message,
        });
      }
    }
  );
}
