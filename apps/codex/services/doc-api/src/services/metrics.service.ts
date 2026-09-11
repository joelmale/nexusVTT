import { Redis } from 'ioredis';
import { env } from '../config/env';
import { PerformanceMetrics } from './health.service';

export interface MetricsHistory {
  timestamp: Date;
  metrics: PerformanceMetrics;
}

export interface MetricsSummary {
  period: '1h' | '24h' | '7d' | '30d';
  startTime: Date;
  endTime: Date;
  dataPoints: number;
  averages: {
    api: {
      requestsPerMinute: number;
      averageResponseTime: number;
      errorRate: number;
      activeConnections: number;
    };
    database: {
      connections: number;
      queryCount: number;
      slowQueries: number;
      connectionPoolUsage: number;
    };
    queue: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      throughput: number;
    };
    storage: {
      totalSize: number;
      usedSize: number;
      fileCount: number;
      uploadRate: number;
    };
    search: {
      queryCount: number;
      averageQueryTime: number;
      indexSize: number;
      documentCount: number;
    };
  };
  peaks: {
    api: {
      requestsPerMinute: number;
      averageResponseTime: number;
      errorRate: number;
      activeConnections: number;
    };
    database: {
      connections: number;
      queryCount: number;
      slowQueries: number;
      connectionPoolUsage: number;
    };
    queue: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      throughput: number;
    };
    storage: {
      totalSize: number;
      usedSize: number;
      fileCount: number;
      uploadRate: number;
    };
    search: {
      queryCount: number;
      averageQueryTime: number;
      indexSize: number;
      documentCount: number;
    };
  };
}

export class MetricsService {
  private static redis = new Redis(env.REDIS_URL);
  private static readonly METRICS_KEY = 'metrics:history';
  private static readonly METRICS_RETENTION_DAYS = 30;

  /**
   * Store performance metrics with timestamp
   */
  static async storeMetrics(metrics: PerformanceMetrics): Promise<void> {
    try {
      const metricsEntry: MetricsHistory = {
        timestamp: metrics.timestamp,
        metrics,
      };

      // Store in Redis sorted set with timestamp as score
      await this.redis.zadd(
        this.METRICS_KEY,
        metrics.timestamp.getTime(),
        JSON.stringify(metricsEntry)
      );

      // Clean up old metrics (older than 30 days)
      const cutoffTime = Date.now() - (this.METRICS_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      await this.redis.zremrangebyscore(this.METRICS_KEY, '-inf', cutoffTime);

    } catch (error: any) {
      console.error('Failed to store metrics:', error);
      // Don't throw - metrics storage failure shouldn't break the application
    }
  }

  /**
   * Get metrics history for a time period
   */
  static async getMetricsHistory(
    startTime: Date,
    endTime: Date = new Date(),
    limit: number = 1000
  ): Promise<MetricsHistory[]> {
    try {
      const metrics = await this.redis.zrangebyscore(
        this.METRICS_KEY,
        startTime.getTime(),
        endTime.getTime(),
        'WITHSCORES',
        'LIMIT',
        0,
        limit
      );

      const result: MetricsHistory[] = [];
      for (let i = 0; i < metrics.length; i += 2) {
        try {
          const entry = JSON.parse(metrics[i]);
          result.push(entry);
        } catch (parseError) {
          // Skip malformed entries
          continue;
        }
      }

      return result.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    } catch (error: any) {
      console.error('Failed to retrieve metrics history:', error);
      return [];
    }
  }

  /**
   * Get metrics summary for a time period
   */
  static async getMetricsSummary(
    period: '1h' | '24h' | '7d' | '30d'
  ): Promise<MetricsSummary> {
    const now = new Date();
    let startTime: Date;

    switch (period) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const history = await this.getMetricsHistory(startTime, now);

    if (history.length === 0) {
      return {
        period,
        startTime,
        endTime: now,
        dataPoints: 0,
        averages: this.getEmptyMetrics(),
        peaks: this.getEmptyMetrics(),
      };
    }

    // Calculate averages and peaks
    const averages = this.calculateAverages(history);
    const peaks = this.calculatePeaks(history);

    return {
      period,
      startTime,
      endTime: now,
      dataPoints: history.length,
      averages,
      peaks,
    };
  }

  /**
   * Get recent metrics (last N data points)
   */
  static async getRecentMetrics(count: number = 50): Promise<MetricsHistory[]> {
    try {
      const metrics = await this.redis.zrevrange(
        this.METRICS_KEY,
        0,
        count - 1,
        'WITHSCORES'
      );

      const result: MetricsHistory[] = [];
      for (let i = 0; i < metrics.length; i += 2) {
        try {
          const entry = JSON.parse(metrics[i]);
          result.push(entry);
        } catch (parseError) {
          continue;
        }
      }

      return result.reverse(); // Return in chronological order
    } catch (error: any) {
      console.error('Failed to retrieve recent metrics:', error);
      return [];
    }
  }

  /**
   * Clean up old metrics (called by cron job)
   */
  static async cleanupOldMetrics(): Promise<number> {
    try {
      const cutoffTime = Date.now() - (this.METRICS_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      const removed = await this.redis.zremrangebyscore(this.METRICS_KEY, '-inf', cutoffTime);
      return removed;
    } catch (error: any) {
      console.error('Failed to cleanup old metrics:', error);
      return 0;
    }
  }

  /**
   * Get metrics storage stats
   */
  static async getStorageStats(): Promise<{
    totalEntries: number;
    oldestEntry?: Date;
    newestEntry?: Date;
    storageSize: number;
  }> {
    try {
      const [count, oldest, newest] = await Promise.all([
        this.redis.zcount(this.METRICS_KEY, '-inf', '+inf'),
        this.redis.zrange(this.METRICS_KEY, 0, 0, 'WITHSCORES'),
        this.redis.zrevrange(this.METRICS_KEY, 0, 0, 'WITHSCORES'),
      ]);

      let oldestEntry: Date | undefined;
      let newestEntry: Date | undefined;

      if (oldest.length >= 2) {
        oldestEntry = new Date(parseInt(oldest[1]));
      }

      if (newest.length >= 2) {
        newestEntry = new Date(parseInt(newest[1]));
      }

      // Estimate storage size (rough calculation)
      const storageSize = count * 1024; // ~1KB per entry

      return {
        totalEntries: count,
        oldestEntry,
        newestEntry,
        storageSize,
      };
    } catch (error: any) {
      console.error('Failed to get storage stats:', error);
      return {
        totalEntries: 0,
        storageSize: 0,
      };
    }
  }

  private static getEmptyMetrics(): any {
    return {
      api: {
        requestsPerMinute: 0,
        averageResponseTime: 0,
        errorRate: 0,
        activeConnections: 0,
      },
      database: {
        connections: 0,
        queryCount: 0,
        slowQueries: 0,
        connectionPoolUsage: 0,
      },
      queue: {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        throughput: 0,
      },
      storage: {
        totalSize: 0,
        usedSize: 0,
        fileCount: 0,
        uploadRate: 0,
      },
      search: {
        queryCount: 0,
        averageQueryTime: 0,
        indexSize: 0,
        documentCount: 0,
      },
    };
  }

  private static calculateAverages(history: MetricsHistory[]): any {
    if (history.length === 0) return this.getEmptyMetrics();

    const sums = this.getEmptyMetrics();

    history.forEach(entry => {
      Object.keys(entry.metrics).forEach(category => {
        Object.keys(entry.metrics[category as keyof PerformanceMetrics]).forEach(metric => {
          const value = (entry.metrics as any)[category][metric];
          if (typeof value === 'number') {
            sums[category][metric] += value;
          }
        });
      });
    });

    const averages = this.getEmptyMetrics();
    Object.keys(sums).forEach(category => {
      Object.keys(sums[category]).forEach(metric => {
        averages[category][metric] = sums[category][metric] / history.length;
      });
    });

    return averages;
  }

  private static calculatePeaks(history: MetricsHistory[]): any {
    if (history.length === 0) return this.getEmptyMetrics();

    const peaks = this.getEmptyMetrics();

    history.forEach(entry => {
      Object.keys(entry.metrics).forEach(category => {
        Object.keys(entry.metrics[category as keyof PerformanceMetrics]).forEach(metric => {
          const value = (entry.metrics as any)[category][metric];
          if (typeof value === 'number') {
            peaks[category][metric] = Math.max(peaks[category][metric], value);
          }
        });
      });
    });

    return peaks;
  }
}