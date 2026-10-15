import { env } from '../config/env';
import { prisma } from './database.service';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

/**
 * Writes operational logs to the log_events table (created by doc-api's
 * migrations). This service's trimmed Prisma schema has no model for it, so it
 * inserts with raw SQL.
 */
class LoggingService {
  private enabled: boolean;
  private serviceName: string;

  constructor() {
    this.enabled = env.LOGGING_ENABLED;
    this.serviceName = env.LOGGING_SERVICE_NAME;
  }

  async log(level: LogLevel, message: string, meta?: Record<string, unknown>): Promise<void> {
    if (!this.enabled) return;

    try {
      const jobId = typeof meta?.jobId === 'string' ? meta.jobId : null;
      const metaJson = meta === undefined ? null : JSON.stringify(meta);
      await prisma.$executeRaw`
        INSERT INTO "log_events" ("level", "service", "message", "jobId", "meta")
        VALUES (${level}, ${this.serviceName}, ${message}, ${jobId}, ${metaJson}::jsonb)
      `;
    } catch (error) {
      console.error('Failed to write log event', error);
    }
  }
}

export const loggingService = new LoggingService();
