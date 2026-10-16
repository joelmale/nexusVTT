import { Prisma } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from './database.service';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface LogEntry {
  timestamp: string;
  '@timestamp': string;
  level: LogLevel;
  service: string;
  message: string;
  meta?: Record<string, unknown>;
  requestId?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Operational logs stored in the log_events table (shared by doc-api,
 * doc-processor and doc-websocket).
 */
class LoggingService {
  private enabled: boolean;
  private serviceName: string;
  private retentionTimer?: NodeJS.Timeout;

  constructor() {
    this.enabled = env.LOGGING_ENABLED;
    this.serviceName = env.LOGGING_SERVICE_NAME;
  }

  async log(level: LogLevel, message: string, meta?: Record<string, unknown>, requestId?: string): Promise<void> {
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
          requestId,
          jobId: typeof meta?.jobId === 'string' ? meta.jobId : undefined,
        },
      });
    } catch (error) {
      // Swallow logging errors to avoid crashing the service
      console.error('Failed to write log event', error);
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
    const timestamp: Prisma.DateTimeFilter = {};
    if (params.from) timestamp.gte = new Date(params.from);
    if (params.to) timestamp.lte = new Date(params.to);

    // Every term must appear in the message (the old simple_query_string AND behaviour).
    const terms = (params.query ?? '').split(/\s+/).filter(Boolean);

    const where: Prisma.LogEventWhereInput = {
      ...(params.services?.length ? { service: { in: params.services } } : {}),
      ...(params.levels?.length ? { level: { in: params.levels } } : {}),
      ...(Object.keys(timestamp).length ? { timestamp } : {}),
      ...(terms.length
        ? { AND: terms.map((term) => ({ message: { contains: term, mode: 'insensitive' as const } })) }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.logEvent.count({ where }),
      prisma.logEvent.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: params.offset || 0,
        take: params.limit || 100,
      }),
    ]);

    return {
      total,
      hits: rows.map((row) => ({
        id: String(row.id),
        '@timestamp': row.timestamp.toISOString(),
        level: row.level,
        service: row.service,
        message: row.message,
        meta: row.meta ?? undefined,
        requestId: row.requestId ?? undefined,
      })),
    };
  }

  async getLogs(jobId: string): Promise<LogEntry[]> {
    const rows = await prisma.logEvent.findMany({
      where: { jobId },
      orderBy: { timestamp: 'asc' },
      take: 100,
    });

    return rows.map((row) => ({
      timestamp: row.timestamp.toISOString(),
      '@timestamp': row.timestamp.toISOString(),
      level: row.level as LogLevel,
      service: row.service,
      message: row.message,
      meta: (row.meta ?? undefined) as Record<string, unknown> | undefined,
      requestId: row.requestId ?? undefined,
    }));
  }

  /** Delete log rows older than LOG_RETENTION_DAYS; returns how many were removed. */
  async pruneOldLogs(retentionDays = env.LOG_RETENTION_DAYS): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * DAY_MS);
    const { count } = await prisma.logEvent.deleteMany({ where: { timestamp: { lt: cutoff } } });
    return count;
  }

  /** Prune once now and then daily. Safe to call once at startup. */
  startRetention(): void {
    if (this.retentionTimer) return;
    const run = () => {
      this.pruneOldLogs().catch((error) => console.error('Failed to prune log events', error));
    };
    run();
    this.retentionTimer = setInterval(run, DAY_MS);
    this.retentionTimer.unref();
  }
}

export const loggingService = new LoggingService();
