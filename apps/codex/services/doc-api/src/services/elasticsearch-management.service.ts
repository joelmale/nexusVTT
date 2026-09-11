import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env';

export interface IndexHealth {
  status: 'green' | 'yellow' | 'red';
  index: string;
  docs: {
    count: number;
    deleted: number;
  };
  store: {
    size: string;
  };
  health: string;
}

export interface IndexStats {
  indices: Record<string, IndexHealth>;
  cluster: {
    status: string;
    nodes: number;
  };
}

export interface ReindexResult {
  success: boolean;
  total: number;
  processed: number;
  failed: number;
  errors: string[];
}

export class ElasticSearchManagementService {
  private static client = new Client({
    node: env.ELASTICSEARCH_URL,
  });

  /**
   * Get cluster and index health information
   */
  static async getIndexHealth(): Promise<IndexStats> {
    try {
      const [clusterHealth, indicesStats] = await Promise.all([
        this.client.cluster.health(),
        this.client.cat.indices({ format: 'json' }),
      ]);

      const indices: Record<string, IndexHealth> = {};

      for (const index of indicesStats) {
        if (!index.index || index.index.startsWith('.')) continue; // Skip system indices

        indices[index.index] = {
          status: index.health as 'green' | 'yellow' | 'red',
          index: index.index,
          docs: {
            count: parseInt(index['docs.count'] || '0'),
            deleted: parseInt(index['docs.deleted'] || '0'),
          },
          store: {
            size: index['store.size'] || '0b',
          },
          health: index.health || 'unknown',
        };
      }

      return {
        indices,
        cluster: {
          status: clusterHealth.status,
          nodes: clusterHealth.number_of_nodes,
        },
      };
    } catch (error) {
      console.error('Failed to get index health:', error);
      throw new Error(`ElasticSearch health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Reindex documents from database to ElasticSearch
   */
  static async reindexDocuments(options: {
    batchSize?: number;
    force?: boolean;
    indexName?: string;
  } = {}): Promise<ReindexResult> {
    const { batchSize = 100, force = false, indexName = env.ELASTICSEARCH_INDEX } = options;

    const result: ReindexResult = {
      success: true,
      total: 0,
      processed: 0,
      failed: 0,
      errors: [],
    };

    try {
      // Import prisma here to avoid circular dependencies
      const { prisma } = await import('../services/database.service');

      // Get total count
      result.total = await prisma.document.count({
        where: {
          ocrStatus: 'completed',
          ...(force ? {} : { searchIndex: null }), // Only reindex documents without search index unless forced
        },
      });

      let offset = 0;

      while (offset < result.total) {
        const documents = await prisma.document.findMany({
          where: {
            ocrStatus: 'completed',
            ...(force ? {} : { searchIndex: null }),
          },
          take: batchSize,
          skip: offset,
          select: {
            id: true,
            title: true,
            description: true,
            type: true,
            author: true,
            tags: true,
            campaigns: true,
            collections: true,
            searchIndex: true,
          },
        });

        for (const doc of documents) {
          try {
            // Generate search document
            const searchDoc = {
              id: doc.id,
              title: doc.title,
              description: doc.description,
              type: doc.type,
              author: doc.author,
              tags: doc.tags,
              campaigns: doc.campaigns,
              collections: doc.collections,
              content: '', // Would need to fetch from ElasticSearch or extract from file
            };

            // Index document
            await this.client.index({
              index: indexName,
              id: doc.id,
              body: searchDoc,
            });

            // Update document with search index reference
            await prisma.document.update({
              where: { id: doc.id },
              data: { searchIndex: doc.id },
            });

            result.processed++;
          } catch (docError: any) {
            result.failed++;
            result.errors.push(`Document ${doc.id}: ${docError.message}`);
          }
        }

        offset += batchSize;
      }
    } catch (error: any) {
      result.success = false;
      result.errors.push(`Reindex failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Delete and recreate index
   */
  static async recreateIndex(indexName?: string): Promise<void> {
    const index = indexName || env.ELASTICSEARCH_INDEX;
    if (!index) {
      throw new Error('Index name is required');
    }
    try {
      // Delete existing index
      await this.client.indices.delete({
        index,
        ignore_unavailable: true,
      });

      // Create new index with basic mapping
      await this.client.indices.create({
        index: index as string,
        body: {
          mappings: {
            properties: {
              title: { type: 'text', analyzer: 'standard' },
              description: { type: 'text', analyzer: 'standard' },
              content: { type: 'text', analyzer: 'standard' },
              type: { type: 'keyword' },
              author: { type: 'text' },
              tags: { type: 'keyword' },
              campaigns: { type: 'keyword' },
              collections: { type: 'keyword' },
            },
          },
        },
      });
    } catch (error) {
      console.error('Failed to recreate index:', error);
      throw new Error(`Index recreation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Optimize index (force merge)
   */
  static async optimizeIndex(indexName: string = env.ELASTICSEARCH_INDEX): Promise<void> {
    try {
      await this.client.indices.forcemerge({
        index: indexName,
        max_num_segments: 1,
      });
    } catch (error) {
      console.error('Failed to optimize index:', error);
      throw new Error(`Index optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get search performance statistics
   */
  static async getSearchStats(): Promise<any> {
    try {
      const response = await this.client.search({
        index: env.ELASTICSEARCH_INDEX,
        body: {
          query: { match_all: {} },
          size: 0,
          aggs: {
            types: {
              terms: { field: 'type' },
            },
            tags: {
              terms: { field: 'tags' },
            },
          },
        },
      });

      return {
        totalDocuments: response.hits.total,
        aggregations: response.aggregations,
      };
    } catch (error) {
      console.error('Failed to get search stats:', error);
      throw new Error(`Search stats retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear all documents from index
   */
  static async clearIndex(indexName: string = env.ELASTICSEARCH_INDEX): Promise<void> {
    try {
      await this.client.deleteByQuery({
        index: indexName,
        body: {
          query: { match_all: {} },
        },
      });
    } catch (error) {
      console.error('Failed to clear index:', error);
      throw new Error(`Index clear failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}