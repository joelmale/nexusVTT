import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

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

  async log(level: LogLevel, message: string, meta?: Record<string, unknown>): Promise<void> {
    if (!this.enabled || !this.client) return;

    try {
      await this.client.index({
        index: this.index,
        document: {
          '@timestamp': new Date().toISOString(),
          level,
          service: this.serviceName,
          message,
          meta,
        },
      });
    } catch (error) {
      console.error('Failed to send log to Elasticsearch', error);
    }
  }
}

export const loggingService = new LoggingService();
