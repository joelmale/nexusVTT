import { Client as ElasticClient } from '@elastic/elasticsearch';
import { env } from '../config/env';
import { MetricsService } from './metrics.service';
import { AlertsService } from './alerts.service';
import { buildProcessingSummary, ProcessingDocumentSnapshot } from './processing-quality.service';

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  responseTime?: number;
  lastChecked: Date;
  details?: Record<string, any>;
  error?: string;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceHealth[];
  timestamp: Date;
  uptime: number;
}

export interface PerformanceMetrics {
  timestamp: Date;
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
}

export class HealthService {
  private static startTime = Date.now();
  private static elasticClient = new ElasticClient({
    node: env.ELASTICSEARCH_URL,
  });

  /**
   * Get comprehensive system health status
   */
  static async getSystemHealth(): Promise<SystemHealth> {
    const services = await Promise.allSettled([
      this.checkDocApiHealth(),
      this.checkDocProcessorHealth(),
      this.checkDocWebsocketHealth(),
      this.checkAdminUiHealth(),
      this.checkDatabaseHealth(),
      this.checkRedisHealth(),
      this.checkElasticSearchHealth(),
      this.checkProcessingQualityHealth(),
      this.checkStorageHealth(),
    ]);

    const serviceResults: ServiceHealth[] = services.map((result, index) => {
      const serviceNames = [
        'doc-api',
        'doc-processor',
        'doc-websocket',
        'admin-ui',
        'database',
        'redis',
        'elasticsearch',
        'processing-quality',
        'storage'
      ];

      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          name: serviceNames[index],
          status: 'unhealthy',
          lastChecked: new Date(),
          error: result.reason?.message || 'Unknown error',
        };
      }
    });

    // Determine overall health
    const unhealthyCount = serviceResults.filter(s => s.status === 'unhealthy').length;
    const unknownCount = serviceResults.filter(s => s.status === 'unknown').length;

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyCount > 0) {
      overall = 'unhealthy';
    } else if (unknownCount > 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    const health = {
      overall,
      services: serviceResults,
      timestamp: new Date(),
      uptime: Date.now() - this.startTime,
    };

    // Check for alerts based on system health
    AlertsService.checkSystemHealth(health).catch(error => {
      console.error('Failed to check system health alerts:', error);
    });

    return health;
  }

  /**
   * Check doc-api health
   */
  private static async checkDocApiHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // Use Docker service name for inter-container communication
      const response = await fetch('http://doc-api:3000/health', {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json() as Record<string, any>;
        return {
          name: 'doc-api',
          status: 'healthy',
          responseTime,
          lastChecked: new Date(),
          details: data,
        };
      } else {
        return {
          name: 'doc-api',
          status: 'unhealthy',
          responseTime,
          lastChecked: new Date(),
          error: `HTTP ${response.status}`,
        };
      }
    } catch (error: any) {
      return {
        name: 'doc-api',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        error: error.message,
      };
    }
  }

  /**
   * Check doc-processor health
   */
  private static async checkDocProcessorHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      // Check if the worker is running by checking Redis queue stats
      const { Redis } = await import('ioredis');
      const redis = new Redis(env.REDIS_URL);

      const waiting = await redis.llen('bull:document-processing:wait');
      const active = await redis.llen('bull:document-processing:active');

      await redis.quit();

      return {
        name: 'doc-processor',
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        details: { waiting, active },
      };
    } catch (error: any) {
      return {
        name: 'doc-processor',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        error: error.message,
      };
    }
  }

  /**
   * Check doc-websocket health
   */
  private static async checkDocWebsocketHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // Use Docker service name for inter-container communication
      const response = await fetch('http://doc-websocket:3002/health', {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json() as Record<string, any>;
        return {
          name: 'doc-websocket',
          status: 'healthy',
          responseTime,
          lastChecked: new Date(),
          details: data,
        };
      } else {
        return {
          name: 'doc-websocket',
          status: 'unhealthy',
          responseTime,
          lastChecked: new Date(),
          error: `HTTP ${response.status}`,
        };
      }
    } catch (error: any) {
      return {
        name: 'doc-websocket',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        error: error.message,
      };
    }
  }

  /**
   * Check admin-ui health
   */
  private static async checkAdminUiHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      // For React app, just check if the server is responding
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // Use Docker service name for inter-container communication (nginx on port 80)
      const response = await fetch('http://admin-ui', {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return {
          name: 'admin-ui',
          status: 'healthy',
          responseTime,
          lastChecked: new Date(),
          details: { note: 'React app server responding' },
        };
      } else {
        return {
          name: 'admin-ui',
          status: 'unhealthy',
          responseTime,
          lastChecked: new Date(),
          error: `HTTP ${response.status}`,
        };
      }
    } catch (error: any) {
      return {
        name: 'admin-ui',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        error: error.message,
      };
    }
  }

  /**
   * Check database health
   */
  private static async checkDatabaseHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      const { prisma } = await import('../services/database.service');

      // Simple query to test connection
      await prisma.$queryRaw`SELECT 1`;

      // Get connection info
      const connectionInfo = await prisma.$queryRaw`
        SELECT
          count(*) as connection_count,
          state
        FROM pg_stat_activity
        WHERE datname = current_database()
        GROUP BY state
      ` as any[];

      // Convert BigInt to Number for JSON serialization (Node.js 22 compatibility)
      const connections = connectionInfo.map((row: any) => ({
        connection_count: typeof row.connection_count === 'bigint' ? Number(row.connection_count) : row.connection_count,
        state: row.state
      }));

      return {
        name: 'database',
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        details: { connections },
      };
    } catch (error: any) {
      return {
        name: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        error: error.message,
      };
    }
  }

  /**
   * Check Redis health
   */
  private static async checkRedisHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      const { Redis } = await import('ioredis');
      const redis = new Redis(env.REDIS_URL);

      const info = await redis.info();
      const memory = await redis.memory('STATS');

      await redis.quit();

      return {
        name: 'redis',
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        details: { info: info.split('\n').slice(0, 10), memory },
      };
    } catch (error: any) {
      return {
        name: 'redis',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        error: error.message,
      };
    }
  }

  /**
   * Check ElasticSearch health
   */
  private static async checkElasticSearchHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      const health = await this.elasticClient.cluster.health();
      const stats = await this.elasticClient.indices.stats();

      return {
        name: 'elasticsearch',
        status: health.status === 'green' ? 'healthy' : health.status === 'yellow' ? 'healthy' : 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        details: {
          cluster: health,
          indices: stats.indices,
        },
      };
    } catch (error: any) {
      return {
        name: 'elasticsearch',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        error: error.message,
      };
    }
  }

  /**
   * Check processing quality health
   */
  private static async checkProcessingQualityHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      const { prisma } = await import('../services/database.service');

      const documents = await prisma.document.findMany({
        select: {
          id: true,
          title: true,
          ocrStatus: true,
          searchIndex: true,
          pageCount: true,
          metadata: true,
        },
      });

      const summary = buildProcessingSummary(documents as ProcessingDocumentSnapshot[]);
      const total = summary.totalDocuments || 1;
      const noTextRatio = summary.noText / total;
      const lowTextRatio = summary.lowText / total;

      let status: ServiceHealth['status'] = 'healthy';
      if (summary.failed > 0 || noTextRatio > 0.25) {
        status = 'unhealthy';
      } else if (summary.ocrPending > 0 || lowTextRatio > 0.25) {
        status = 'degraded';
      }

      return {
        name: 'processing-quality',
        status,
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        details: summary,
      };
    } catch (error: any) {
      return {
        name: 'processing-quality',
        status: 'unknown',
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        error: error.message,
      };
    }
  }

  /**
   * Check storage health
   */
  private static async checkStorageHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      const { s3Service } = await import('../services/s3.service');

      // Try to check bucket access
      await s3Service.initializeBucket();

      return {
        name: 'storage',
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        details: { bucketAccessible: true },
      };
    } catch (error: any) {
      return {
        name: 'storage',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        error: error.message,
      };
    }
  }

  /**
   * Collect performance metrics
   */
  static async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    const metrics: PerformanceMetrics = {
      timestamp: new Date(),
      api: await this.collectApiMetrics(),
      database: await this.collectDatabaseMetrics(),
      queue: await this.collectQueueMetrics(),
      storage: await this.collectStorageMetrics(),
      search: await this.collectSearchMetrics(),
    };

    // Store metrics asynchronously (don't await to avoid blocking)
    MetricsService.storeMetrics(metrics).catch(error => {
      console.error('Failed to store metrics:', error);
    });

    // Check for alerts based on metrics
    AlertsService.checkPerformanceMetrics(metrics).catch(error => {
      console.error('Failed to check performance alerts:', error);
    });

    return metrics;
  }

  private static async collectApiMetrics() {
    // This would typically collect from application metrics
    // For now, return placeholder data
    return {
      requestsPerMinute: 0,
      averageResponseTime: 0,
      errorRate: 0,
      activeConnections: 0,
    };
  }

  private static async collectDatabaseMetrics() {
    try {
      const { prisma } = await import('../services/database.service');

      const connectionInfo = await prisma.$queryRaw`
        SELECT count(*) as connections
        FROM pg_stat_activity
        WHERE datname = current_database()
      ` as any;

      // Convert BigInt to Number for JSON serialization (Node.js 22 compatibility)
      const connections = connectionInfo[0]?.connections;
      return {
        connections: typeof connections === 'bigint' ? Number(connections) : parseInt(String(connections || '0')),
        queryCount: 0, // Would need query logging to track
        slowQueries: 0,
        connectionPoolUsage: 0,
      };
    } catch (error) {
      return {
        connections: 0,
        queryCount: 0,
        slowQueries: 0,
        connectionPoolUsage: 0,
      };
    }
  }

  private static async collectQueueMetrics() {
    try {
      const { Redis } = await import('ioredis');
      const redis = new Redis(env.REDIS_URL);

      const [waiting, active, completed, failed] = await Promise.all([
        redis.llen('bull:document-processing:wait'),
        redis.llen('bull:document-processing:active'),
        redis.get('bull:document-processing:completed'),
        redis.get('bull:document-processing:failed'),
      ]);

      await redis.quit();

      return {
        waiting,
        active,
        completed: parseInt(completed || '0'),
        failed: parseInt(failed || '0'),
        throughput: 0, // Would need historical data
      };
    } catch (error) {
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        throughput: 0,
      };
    }
  }

  private static async collectStorageMetrics() {
    try {
      // For now, return placeholder data since we don't have a listObjects method
      // In a real implementation, you'd need to add S3 list operations
      return {
        totalSize: 0, // Would need to aggregate from database or S3
        usedSize: 0,
        fileCount: 0, // Would need to count from database
        uploadRate: 0, // Would need historical data
      };
    } catch (error) {
      return {
        totalSize: 0,
        usedSize: 0,
        fileCount: 0,
        uploadRate: 0,
      };
    }
  }

  private static async collectSearchMetrics() {
    try {
      const stats = await this.elasticClient.indices.stats();

      return {
        queryCount: 0, // Would need search logging
        averageQueryTime: 0,
        indexSize: stats.indices ? Object.values(stats.indices).reduce((sum: any, index: any) =>
          sum + (index.total?.store?.size_in_bytes || 0), 0) : 0,
        documentCount: stats.indices ? Object.values(stats.indices).reduce((sum: any, index: any) =>
          sum + (index.total?.docs?.count || 0), 0) : 0,
      };
    } catch (error) {
      return {
        queryCount: 0,
        averageQueryTime: 0,
        indexSize: 0,
        documentCount: 0,
      };
    }
  }
}
