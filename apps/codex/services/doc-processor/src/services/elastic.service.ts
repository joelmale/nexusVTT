import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env';

class ElasticSearchService {
  private client: Client;
  private index: string;

  constructor() {
    this.client = new Client({
      node: env.ELASTICSEARCH_URL,
    });
    this.index = env.ELASTICSEARCH_INDEX;
  }

  /**
   * Initialize the index with proper mappings
   */
  async initializeIndex(): Promise<void> {
    try {
      const indexExists = await this.client.indices.exists({ index: this.index });

      if (!indexExists) {
        await this.client.indices.create({
          index: this.index,
          body: {
            mappings: {
              properties: {
                documentId: { type: 'keyword' },
                title: { type: 'text', analyzer: 'english' },
                description: { type: 'text' },
                content: { type: 'text', analyzer: 'english' },
                tags: { type: 'keyword' },
                type: { type: 'keyword' },
                campaigns: { type: 'keyword' },
                collections: { type: 'keyword' },
                uploadedAt: { type: 'date' },
              },
            },
            settings: {
              number_of_shards: 1,
              number_of_replicas: 0,
            },
          },
        });

        console.log(`ElasticSearch index "${this.index}" created successfully`);
      } else {
        console.log(`ElasticSearch index "${this.index}" already exists`);
      }
    } catch (error: any) {
      console.error('Failed to initialize ElasticSearch index:', error.message);
      throw error;
    }
  }

  /**
   * Index a document
   */
  async indexDocument(data: {
    documentId: string;
    title: string;
    description: string;
    content: string;
    tags: string[];
    type: string;
    campaigns: string[];
    collections: string[];
    uploadedAt: Date;
  }): Promise<string> {
    try {
      const response = await this.client.index({
        index: this.index,
        id: data.documentId,
        document: data,
      });

      return response._id;
    } catch (error: any) {
      throw new Error(`Failed to index document: ${error.message}`);
    }
  }

  /**
   * Delete a document from the index
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      await this.client.delete({
        index: this.index,
        id: documentId,
      });
    } catch (error: any) {
      if (error.meta?.statusCode === 404) {
        // Document not found in index, ignore
        return;
      }
      throw new Error(`Failed to delete document from index: ${error.message}`);
    }
  }

  /**
   * Search documents
   */
  async search(params: {
    query: string;
    filters?: {
      type?: string;
      campaigns?: string[];
      tags?: string[];
    };
    from?: number;
    size?: number;
  }) {
    const must: any[] = [];

    // Add text search query
    if (params.query) {
      must.push({
        multi_match: {
          query: params.query,
          fields: ['title^3', 'description^2', 'content'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    // Add filters
    const filter: any[] = [];

    if (params.filters?.type) {
      filter.push({ term: { type: params.filters.type } });
    }

    if (params.filters?.campaigns && params.filters.campaigns.length > 0) {
      filter.push({ terms: { campaigns: params.filters.campaigns } });
    }

    if (params.filters?.tags && params.filters.tags.length > 0) {
      filter.push({ terms: { tags: params.filters.tags } });
    }

    try {
      const response = await this.client.search({
        index: this.index,
        from: params.from || 0,
        size: params.size || 20,
        body: {
          query: {
            bool: {
              must: must.length > 0 ? must : [{ match_all: {} }],
              filter: filter.length > 0 ? filter : undefined,
            },
          },
          highlight: {
            fields: {
              title: {},
              description: {},
              content: {
                fragment_size: 150,
                number_of_fragments: 3,
              },
            },
          },
          sort: [
            { _score: { order: 'desc' as const } },
            { uploadedAt: { order: 'desc' as const } },
          ],
        },
      });

      return {
        total: typeof response.hits.total === 'object' ? response.hits.total.value : response.hits.total,
        hits: response.hits.hits.map((hit: any) => ({
          documentId: hit._id,
          score: hit._score,
          source: hit._source,
          highlights: hit.highlight,
        })),
      };
    } catch (error: any) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }
}

export const elasticService = new ElasticSearchService();
