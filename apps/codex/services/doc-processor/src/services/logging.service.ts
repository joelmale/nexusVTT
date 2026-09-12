import Redis from 'ioredis';
import { env } from '../config/env';
import { centralLoggingService } from './central-logging.service';

// Create Redis connection (reuse the same connection as queue service)
const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export interface ProcessingLog {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  message: string;
  step?: string;
  details?: any;
}

class LoggingService {
  private getLogKey(jobId: string): string {
    return `job:logs:${jobId}`;
  }

  /**
   * Add a log entry for a job
   */
  async addLog(jobId: string, log: ProcessingLog): Promise<void> {
    const key = this.getLogKey(jobId);
    const logEntry = JSON.stringify({
      ...log,
      timestamp: log.timestamp || new Date().toISOString(),
    });

    // Add to list and set TTL (7 days)
    await redis.lpush(key, logEntry);
    await redis.expire(key, 7 * 24 * 60 * 60);

    await centralLoggingService.log(log.level, log.message, {
      jobId,
      step: log.step,
      details: log.details,
    });
  }

  /**
   * Get all logs for a job
   */
  async getLogs(jobId: string): Promise<ProcessingLog[]> {
    const key = this.getLogKey(jobId);
    const logs = await redis.lrange(key, 0, -1);

    return logs
      .map(log => {
        try {
          return JSON.parse(log);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .reverse(); // Return in chronological order
  }

  /**
   * Clear logs for a job
   */
  async clearLogs(jobId: string): Promise<void> {
    const key = this.getLogKey(jobId);
    await redis.del(key);
  }

  /**
   * Log an info message
   */
  async logInfo(jobId: string, message: string, step?: string, details?: any): Promise<void> {
    await this.addLog(jobId, {
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      step,
      details,
    });
  }

  /**
   * Log a warning message
   */
  async logWarn(jobId: string, message: string, step?: string, details?: any): Promise<void> {
    await this.addLog(jobId, {
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      step,
      details,
    });
  }

  /**
   * Log an error message
   */
  async logError(jobId: string, message: string, step?: string, details?: any): Promise<void> {
    await this.addLog(jobId, {
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      step,
      details,
    });
  }

  async logCritical(jobId: string, message: string, step?: string, details?: any): Promise<void> {
    await this.addLog(jobId, {
      timestamp: new Date().toISOString(),
      level: 'critical',
      message,
      step,
      details,
    });
  }
}

export const loggingService = new LoggingService();
