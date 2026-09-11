import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  meta?: Record<string, unknown>;
  requestId?: string;
}

class LoggingService {
  private client?: Client;
  private enabled: boolean;
  private index: string;
  private serviceName: string;

  constructor() {
    this.enabled = env.LOGGING_ENABLED;
    this.index = env.LOGGING_INDEX;
    this.serviceName = env.LOGGING_SERVICE_NAME;
    if (this.enabled) {
      this.client = new Client({ node: env.ELASTICSEARCH_URL });
    }
  }

  async log(level: LogLevel, message: string, meta?: Record<string, unknown>, requestId?: string): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message,
      meta,
      requestId,
    };

    if (!this.enabled || !this.client) {
      return;
    }

    try {
      await this.client.index({
        index: this.index,
        document: {
          '@timestamp': entry.timestamp,
          level: entry.level,
          service: entry.service,
          message: entry.message,
          meta: entry.meta,
          requestId: entry.requestId,
        },
      });
    } catch (error) {
      // Swallow logging errors to avoid crashing the service
      console.error('Failed to send log to Elasticsearch', error);
    }
  }

  async search(params: {
    services?: string[];
    levels?: LogLevel[];
    query?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }) {
    if (!this.client) {
      return { total: 0, hits: [] };
    }

    const filters: any[] = [];
    if (params.services?.length) {
      filters.push({ terms: { 'service.keyword': params.services } });
    }
    if (params.levels?.length) {
      filters.push({ terms: { 'level.keyword': params.levels } });
    }
    if (params.from || params.to) {
      const range: Record<string, string> = {};
      if (params.from) range.gte = params.from;
      if (params.to) range.lte = params.to;
      filters.push({ range: { '@timestamp': range } });
    }

    const must: any[] = [];
    if (params.query) {
      must.push({
        simple_query_string: {
          query: params.query,
          fields: ['message'],
          default_operator: 'and',
        },
      });
    }

    const response = await this.client.search({
      index: this.index,
      from: params.offset || 0,
      size: params.limit || 100,
      sort: [{ '@timestamp': { order: 'desc' } }],
      query: {
        bool: {
          filter: filters.length ? filters : undefined,
          must: must.length ? must : undefined,
        },
      },
    });

    const hits = response.hits.hits.map((hit: any) => ({
      id: hit._id,
      ...hit._source,
    }));

    const total = typeof response.hits.total === 'object' ? response.hits.total.value : response.hits.total;

    return { total, hits };
  }
}

export const loggingService = new LoggingService();
