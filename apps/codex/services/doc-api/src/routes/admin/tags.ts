import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../services/database.service';
import { z } from 'zod';

// Tag metadata schemas
const CreateTagSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  description: z.string().optional(),
});

const UpdateTagSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  description: z.string().optional(),
});

const MergeTagsSchema = z.object({
  sourceTagNames: z.array(z.string()).min(1),
  targetTagName: z.string().min(1),
  targetCategory: z.string().optional(),
  targetColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

type CreateTagInput = z.infer<typeof CreateTagSchema>;
type UpdateTagInput = z.infer<typeof UpdateTagSchema>;
type MergeTagsInput = z.infer<typeof MergeTagsSchema>;

export async function adminTagRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/admin/tags - List all tags with usage count and metadata
   */
  fastify.get<{ Querystring: { category?: string; sortBy?: string; order?: string } }>(
    '/api/admin/tags',
    async (request: FastifyRequest<{ Querystring: { category?: string; sortBy?: string; order?: string } }>, reply: FastifyReply) => {
      try {
        const { category, sortBy = 'usage', order = 'desc' } = request.query;

        // Get all unique tags from documents
        const tagsInUse = await prisma.$queryRaw<Array<{ tag: string; count: number }>>`
          SELECT unnest(tags) as tag, COUNT(*) as count
          FROM documents
          GROUP BY tag
          ORDER BY count DESC
        `;

        // Get all tag metadata
        const where = category ? { category } : {};
        const tagMetadata = await prisma.tagMetadata.findMany({ where });

        // Create a map of tag metadata
        const metadataMap = new Map(tagMetadata.map(tm => [tm.name, tm]));

        // Combine usage data with metadata
        const tags = tagsInUse.map(tag => {
          const metadata = metadataMap.get(tag.tag);
          return {
            name: tag.tag,
            usage: Number(tag.count),
            category: metadata?.category || null,
            color: metadata?.color || null,
            description: metadata?.description || null,
            id: metadata?.id || null,
            createdAt: metadata?.createdAt || null,
          };
        });

        // Add tags that have metadata but no usage
        for (const metadata of tagMetadata) {
          if (!tags.find(t => t.name === metadata.name)) {
            tags.push({
              name: metadata.name,
              usage: 0,
              category: metadata.category || null,
              color: metadata.color || null,
              description: metadata.description || null,
              id: metadata.id,
              createdAt: metadata.createdAt,
            });
          }
        }

        // Sort tags
        if (sortBy === 'usage') {
          tags.sort((a, b) => order === 'asc' ? a.usage - b.usage : b.usage - a.usage);
        } else if (sortBy === 'name') {
          tags.sort((a, b) => order === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
        } else if (sortBy === 'category') {
          tags.sort((a, b) => {
            const catA = a.category || '';
            const catB = b.category || '';
            return order === 'asc' ? catA.localeCompare(catB) : catB.localeCompare(catA);
          });
        }

        return reply.send({
          tags,
          total: tags.length,
          summary: {
            totalTags: tags.length,
            tagsInUse: tags.filter(t => t.usage > 0).length,
            unusedTags: tags.filter(t => t.usage === 0).length,
            withMetadata: tags.filter(t => t.id !== null).length,
          },
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to get tags',
          details: error.message,
        });
      }
    }
  );

  /**
   * POST /api/admin/tags - Create tag metadata
   */
  fastify.post<{ Body: CreateTagInput }>(
    '/api/admin/tags',
    async (request: FastifyRequest<{ Body: CreateTagInput }>, reply: FastifyReply) => {
      try {
        const data = CreateTagSchema.parse(request.body);

        // Check if tag metadata already exists
        const existing = await prisma.tagMetadata.findUnique({
          where: { name: data.name },
        });

        if (existing) {
          return reply.status(409).send({
            error: 'Tag metadata already exists',
            details: `Tag "${data.name}" already has metadata`,
          });
        }

        // Create tag metadata
        const tagMetadata = await prisma.tagMetadata.create({
          data,
        });

        return reply.status(201).send(tagMetadata);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(400).send({
          error: 'Failed to create tag metadata',
          details: error.message,
        });
      }
    }
  );

  /**
   * PATCH /api/admin/tags/:id - Update tag metadata (rename updates all documents)
   */
  fastify.patch<{ Params: { id: string }; Body: UpdateTagInput }>(
    '/api/admin/tags/:id',
    async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateTagInput }>, reply: FastifyReply) => {
      try {
        const tagId = request.params.id;
        const data = UpdateTagSchema.parse(request.body);

        // Get existing tag metadata
        const existing = await prisma.tagMetadata.findUnique({
          where: { id: tagId },
        });

        if (!existing) {
          return reply.status(404).send({ error: 'Tag metadata not found' });
        }

        // If renaming, update all documents
        if (data.name && data.name !== existing.name) {
          // Check if new name already exists
          const nameExists = await prisma.tagMetadata.findUnique({
            where: { name: data.name },
          });

          if (nameExists) {
            return reply.status(409).send({
              error: 'Tag name already exists',
              details: `Tag "${data.name}" already exists`,
            });
          }

          // Get all documents with the old tag
          const documents = await prisma.document.findMany({
            where: {
              tags: { has: existing.name },
            },
            select: { id: true, tags: true },
          });

          // Update each document's tags
          for (const doc of documents) {
            const updatedTags = doc.tags.map(tag => tag === existing.name ? (data.name as string) : tag);
            await prisma.document.update({
              where: { id: doc.id },
              data: { tags: updatedTags },
            });
          }

          fastify.log.info(`Renamed tag "${existing.name}" to "${data.name}" in ${documents.length} documents`);
        }

        // Update tag metadata
        const updatedTag = await prisma.tagMetadata.update({
          where: { id: tagId },
          data,
        });

        return reply.send({
          tagMetadata: updatedTag,
          documentsUpdated: data.name && data.name !== existing.name ? await prisma.document.count({
            where: { tags: { has: data.name } },
          }) : 0,
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(400).send({
          error: 'Failed to update tag',
          details: error.message,
        });
      }
    }
  );

  /**
   * DELETE /api/admin/tags/:id - Delete tag (remove from all documents or fail if in use)
   */
  fastify.delete<{ Params: { id: string }; Querystring: { force?: string } }>(
    '/api/admin/tags/:id',
    async (request: FastifyRequest<{ Params: { id: string }; Querystring: { force?: string } }>, reply: FastifyReply) => {
      try {
        const tagId = request.params.id;
        const force = request.query.force === 'true';

        // Get tag metadata
        const tagMetadata = await prisma.tagMetadata.findUnique({
          where: { id: tagId },
        });

        if (!tagMetadata) {
          return reply.status(404).send({ error: 'Tag metadata not found' });
        }

        // Check if tag is in use
        const documentsWithTag = await prisma.document.count({
          where: { tags: { has: tagMetadata.name } },
        });

        if (documentsWithTag > 0 && !force) {
          return reply.status(409).send({
            error: 'Tag is in use',
            details: `Tag "${tagMetadata.name}" is used in ${documentsWithTag} documents. Use force=true to remove from all documents.`,
            documentsAffected: documentsWithTag,
          });
        }

        // If force, remove tag from all documents
        if (force && documentsWithTag > 0) {
          const documents = await prisma.document.findMany({
            where: { tags: { has: tagMetadata.name } },
            select: { id: true, tags: true },
          });

          for (const doc of documents) {
            const updatedTags = doc.tags.filter(tag => tag !== tagMetadata.name);
            await prisma.document.update({
              where: { id: doc.id },
              data: { tags: updatedTags },
            });
          }

          fastify.log.info(`Removed tag "${tagMetadata.name}" from ${documentsWithTag} documents`);
        }

        // Delete tag metadata
        await prisma.tagMetadata.delete({
          where: { id: tagId },
        });

        return reply.send({
          message: 'Tag deleted successfully',
          tagName: tagMetadata.name,
          documentsUpdated: documentsWithTag,
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to delete tag',
          details: error.message,
        });
      }
    }
  );

  /**
   * POST /api/admin/tags/merge - Merge multiple tags into one
   */
  fastify.post<{ Body: MergeTagsInput }>(
    '/api/admin/tags/merge',
    async (request: FastifyRequest<{ Body: MergeTagsInput }>, reply: FastifyReply) => {
      try {
        const data = MergeTagsSchema.parse(request.body);

        // Validate that source tags exist and get their usage
        const sourceTags = await Promise.all(
          data.sourceTagNames.map(async (tagName) => {
            const count = await prisma.document.count({
              where: { tags: { has: tagName } },
            });
            return { name: tagName, usage: count };
          })
        );

        const totalDocumentsAffected = sourceTags.reduce((sum, tag) => sum + tag.usage, 0);

        if (totalDocumentsAffected === 0) {
          return reply.status(400).send({
            error: 'No documents use the source tags',
            details: 'Source tags are not in use',
          });
        }

        // Check if target tag already exists
        const targetExists = await prisma.document.count({
          where: { tags: { has: data.targetTagName } },
        });

        // Get all documents with any source tag
        const documents = await prisma.document.findMany({
          where: {
            tags: { hasSome: data.sourceTagNames },
          },
          select: { id: true, tags: true },
        });

        // Update each document
        for (const doc of documents) {
          // Remove all source tags and add target tag
          let updatedTags = doc.tags.filter(tag => !data.sourceTagNames.includes(tag));

          // Add target tag if not already present
          if (!updatedTags.includes(data.targetTagName)) {
            updatedTags.push(data.targetTagName);
          }

          await prisma.document.update({
            where: { id: doc.id },
            data: { tags: updatedTags },
          });
        }

        // Create or update target tag metadata
        const existingTargetMetadata = await prisma.tagMetadata.findUnique({
          where: { name: data.targetTagName },
        });

        if (existingTargetMetadata) {
          // Update if category or color provided
          if (data.targetCategory || data.targetColor) {
            await prisma.tagMetadata.update({
              where: { id: existingTargetMetadata.id },
              data: {
                category: data.targetCategory || existingTargetMetadata.category,
                color: data.targetColor || existingTargetMetadata.color,
              },
            });
          }
        } else {
          // Create new metadata for target tag
          await prisma.tagMetadata.create({
            data: {
              name: data.targetTagName,
              category: data.targetCategory,
              color: data.targetColor,
            },
          });
        }

        // Delete source tag metadata if they exist
        for (const sourceTag of data.sourceTagNames) {
          try {
            await prisma.tagMetadata.deleteMany({
              where: { name: sourceTag },
            });
          } catch (error) {
            // Ignore if metadata doesn't exist
          }
        }

        return reply.send({
          message: 'Tags merged successfully',
          sourceTags: data.sourceTagNames,
          targetTag: data.targetTagName,
          documentsUpdated: documents.length,
          summary: {
            sourceTagsRemoved: data.sourceTagNames.length,
            documentsAffected: documents.length,
            targetTagExisted: targetExists > 0,
          },
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(400).send({
          error: 'Failed to merge tags',
          details: error.message,
        });
      }
    }
  );

  /**
   * GET /api/admin/tags/unused - Get tags with zero usage
   */
  fastify.get(
    '/api/admin/tags/unused',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Get all tag metadata
        const allMetadata = await prisma.tagMetadata.findMany();

        // Filter to only those with zero usage
        const unusedTags = [];
        for (const metadata of allMetadata) {
          const count = await prisma.document.count({
            where: { tags: { has: metadata.name } },
          });
          if (count === 0) {
            unusedTags.push({
              id: metadata.id,
              name: metadata.name,
              category: metadata.category,
              color: metadata.color,
              description: metadata.description,
              createdAt: metadata.createdAt,
            });
          }
        }

        return reply.send({
          unusedTags,
          total: unusedTags.length,
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to get unused tags',
          details: error.message,
        });
      }
    }
  );

  /**
   * DELETE /api/admin/tags/unused - Delete all unused tags
   */
  fastify.delete(
    '/api/admin/tags/unused',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Get all tag metadata
        const allMetadata = await prisma.tagMetadata.findMany();

        // Find and delete unused tags
        const deletedTags = [];
        for (const metadata of allMetadata) {
          const count = await prisma.document.count({
            where: { tags: { has: metadata.name } },
          });
          if (count === 0) {
            await prisma.tagMetadata.delete({
              where: { id: metadata.id },
            });
            deletedTags.push(metadata.name);
          }
        }

        return reply.send({
          message: 'Unused tags deleted successfully',
          deletedTags,
          total: deletedTags.length,
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to delete unused tags',
          details: error.message,
        });
      }
    }
  );
}
