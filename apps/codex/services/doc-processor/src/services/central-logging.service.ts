import { Prisma } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from './database.service';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  meta?: Record<string, unknown>;
}

/**
 * Writes operational logs to the log_events table that doc-api reads for the
 * admin Logs page and per-job logs. Replaces the Elasticsearch nexus-logs index.
 */
class CentralLoggingService {
  private enabled: boolean;
  private serviceName: string;

  constructor() {
    this.enabled = env.LOGGING_ENABLED;
    this.serviceName = env.LOGGING_SERVICE_NAME;
  }

  async log(level: LogLevel, message: string, meta?: Record<string, unknown>): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      await prisma.logEvent.create({
        data: {
          level,
          service: this.serviceName,
          message,
          meta: meta === undefined ? undefined : (meta as Prisma.InputJsonValue),
          jobId: typeof meta?.jobId === 'string' ? meta.jobId : undefined,
        },
      });
    } catch (error) {
      console.error('Failed to write log event', error);
    }
  }
}

export const centralLoggingService = new CentralLoggingService();
