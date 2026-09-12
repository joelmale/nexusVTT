import { FastifyInstance } from 'fastify';
import { HealthService } from '../../services/health.service';
import { MetricsService } from '../../services/metrics.service';
import { AlertsService } from '../../services/alerts.service';

export async function healthRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/admin/health - Get comprehensive system health status
   */
  fastify.get('/api/admin/health', async (_request, reply) => {
    try {
      const health = await HealthService.getSystemHealth();
      return reply.send(health);
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to get system health',
        details: error.message,
      });
    }
  });

  /**
    * GET /api/admin/health/services/:service - Get health of specific service
    */
  fastify.get('/api/admin/health/services/:service', async (_request, reply) => {
    const { service } = _request.params as { service: string };

    try {
      const systemHealth = await HealthService.getSystemHealth();
      const serviceHealth = systemHealth.services.find(s => s.name === service);

      if (!serviceHealth) {
        return reply.status(404).send({ error: 'Service not found' });
      }

      return reply.send(serviceHealth);
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to get service health',
        details: error.message,
      });
    }
  });

  /**
    * GET /api/admin/metrics - Get current performance metrics
    */
  fastify.get('/api/admin/metrics', async (_request, reply) => {
    try {
      const metrics = await HealthService.collectPerformanceMetrics();
      return reply.send(metrics);
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to collect metrics',
        details: error.message,
      });
    }
  });

  /**
    * GET /api/admin/health/check - Simple health check for monitoring systems
    */
  fastify.get('/api/admin/health/check', async (_request, reply) => {
    try {
      const health = await HealthService.getSystemHealth();

      if (health.overall === 'healthy') {
        return reply.send({
          status: 'healthy',
          timestamp: health.timestamp,
          uptime: health.uptime,
        });
      } else {
        return reply.status(503).send({
          status: health.overall,
          timestamp: health.timestamp,
          uptime: health.uptime,
          issues: health.services.filter(s => s.status !== 'healthy'),
        });
      }
    } catch (error: any) {
      return reply.status(503).send({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date(),
      });
    }
  });

  /**
    * GET /api/admin/metrics/history - Get metrics history
    */
  fastify.get('/api/admin/metrics/history', async (_request, reply) => {
    const { start, end, limit } = _request.query as {
      start?: string;
      end?: string;
      limit?: string;
    };

    try {
      const startTime = start ? new Date(start) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endTime = end ? new Date(end) : new Date();
      const limitNum = limit ? parseInt(limit) : 1000;

      const history = await MetricsService.getMetricsHistory(startTime, endTime, limitNum);
      return reply.send(history);
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to retrieve metrics history',
        details: error.message,
      });
    }
  });

  /**
    * GET /api/admin/metrics/summary/:period - Get metrics summary for a time period
    */
  fastify.get('/api/admin/metrics/summary/:period', async (_request, reply) => {
    const { period } = _request.params as { period: '1h' | '24h' | '7d' | '30d' };

    if (!['1h', '24h', '7d', '30d'].includes(period)) {
      return reply.status(400).send({
        error: 'Invalid period. Must be one of: 1h, 24h, 7d, 30d',
      });
    }

    try {
      const summary = await MetricsService.getMetricsSummary(period);
      return reply.send(summary);
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to retrieve metrics summary',
        details: error.message,
      });
    }
  });

  /**
    * GET /api/admin/metrics/recent - Get recent metrics
    */
  fastify.get('/api/admin/metrics/recent', async (_request, reply) => {
    const { count } = _request.query as { count?: string };

    try {
      const countNum = count ? parseInt(count) : 50;
      const recent = await MetricsService.getRecentMetrics(countNum);
      return reply.send(recent);
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to retrieve recent metrics',
        details: error.message,
      });
    }
  });

  /**
    * GET /api/admin/metrics/storage - Get metrics storage statistics
    */
  fastify.get('/api/admin/metrics/storage', async (_request, reply) => {
    try {
      const stats = await MetricsService.getStorageStats();
      return reply.send(stats);
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to retrieve storage stats',
        details: error.message,
      });
    }
  });

  /**
    * DELETE /api/admin/metrics/cleanup - Clean up old metrics
    */
  fastify.delete('/api/admin/metrics/cleanup', async (_request, reply) => {
    try {
      const removed = await MetricsService.cleanupOldMetrics();
      return reply.send({
        message: `Cleaned up ${removed} old metrics entries`,
        removed,
      });
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to cleanup metrics',
        details: error.message,
      });
    }
  });

  /**
    * GET /api/admin/alerts - Get active alerts
    */
  fastify.get('/api/admin/alerts', async (_request, reply) => {
    try {
      const alerts = await AlertsService.getActiveAlerts();
      return reply.send(alerts);
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to retrieve alerts',
        details: error.message,
      });
    }
  });

  /**
    * GET /api/admin/alerts/history - Get alerts history
    */
  fastify.get('/api/admin/alerts/history', async (_request, reply) => {
    const { limit } = _request.query as { limit?: string };

    try {
      const limitNum = limit ? parseInt(limit) : 100;
      const history = await AlertsService.getAlertsHistory(limitNum);
      return reply.send(history);
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to retrieve alerts history',
        details: error.message,
      });
    }
  });

  /**
    * POST /api/admin/alerts/:id/acknowledge - Acknowledge an alert
    */
  fastify.post('/api/admin/alerts/:id/acknowledge', async (_request, reply) => {
    const { id } = _request.params as { id: string };
    // Use default userId since auth is disabled for development
    const userId = 'default-user-id';

    try {
      await AlertsService.acknowledgeAlert(id, userId);
      return reply.send({ message: 'Alert acknowledged' });
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to acknowledge alert',
        details: error.message,
      });
    }
  });

  /**
    * POST /api/admin/alerts/:id/resolve - Resolve an alert
    */
  fastify.post('/api/admin/alerts/:id/resolve', async (_request, reply) => {
    const { id } = _request.params as { id: string };

    try {
      await AlertsService.resolveAlert(id);
      return reply.send({ message: 'Alert resolved' });
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to resolve alert',
        details: error.message,
      });
    }
  });

  /**
    * GET /api/admin/alerts/rules - Get alert rules
    */
  fastify.get('/api/admin/alerts/rules', async (_request, reply) => {
    try {
      const rules = await AlertsService.getAlertRules();
      return reply.send(rules);
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to retrieve alert rules',
        details: error.message,
      });
    }
  });

  /**
    * PUT /api/admin/alerts/rules - Update alert rules
    */
  fastify.put('/api/admin/alerts/rules', async (_request, reply) => {
    const rules = _request.body as any[];

    try {
      await AlertsService.updateAlertRules(rules);
      return reply.send({ message: 'Alert rules updated' });
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to update alert rules',
        details: error.message,
      });
    }
  });

  /**
    * GET /api/admin/alerts/stats - Get alert statistics
    */
  fastify.get('/api/admin/alerts/stats', async (_request, reply) => {
    try {
      const stats = await AlertsService.getAlertStats();
      return reply.send(stats);
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to retrieve alert stats',
        details: error.message,
      });
    }
  });

  /**
    * POST /api/admin/alerts/cleanup - Clean up old alerts
    */
  fastify.post('/api/admin/alerts/cleanup', async (_request, reply) => {
    try {
      const cleaned = await AlertsService.cleanupOldAlerts();
      return reply.send({
        message: `Cleaned up ${cleaned} old alerts`,
        cleaned,
      });
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to cleanup alerts',
        details: error.message,
      });
    }
  });
}