import { Redis } from 'ioredis';
import { env } from '../config/env';
import { SystemHealth, ServiceHealth, PerformanceMetrics } from './health.service';

export interface Alert {
  id: string;
  type: 'service_down' | 'service_slow' | 'high_error_rate' | 'queue_backlog' | 'storage_full' | 'search_unavailable';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  service?: string;
  value?: number;
  threshold?: number;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

export interface AlertRule {
  id: string;
  type: Alert['type'];
  enabled: boolean;
  severity: Alert['severity'];
  threshold: number;
  description: string;
  cooldownMinutes: number; // Prevent alert spam
}

export class AlertsService {
  private static redis = new Redis(env.REDIS_URL);
  private static readonly ALERTS_KEY = 'alerts:active';
  private static readonly ALERTS_HISTORY_KEY = 'alerts:history';
  private static readonly ALERT_RULES_KEY = 'alerts:rules';

  // Default alert rules
  private static defaultRules: AlertRule[] = [
    {
      id: 'service_response_time',
      type: 'service_slow',
      enabled: true,
      severity: 'medium',
      threshold: 5000, // 5 seconds
      description: 'Service response time exceeds threshold',
      cooldownMinutes: 5,
    },
    {
      id: 'api_error_rate',
      type: 'high_error_rate',
      enabled: true,
      severity: 'high',
      threshold: 0.05, // 5% error rate
      description: 'API error rate exceeds 5%',
      cooldownMinutes: 10,
    },
    {
      id: 'queue_backlog',
      type: 'queue_backlog',
      enabled: true,
      severity: 'medium',
      threshold: 100, // 100+ jobs waiting
      description: 'Document processing queue has high backlog',
      cooldownMinutes: 15,
    },
    {
      id: 'storage_usage',
      type: 'storage_full',
      enabled: true,
      severity: 'critical',
      threshold: 0.9, // 90% storage used
      description: 'Storage usage exceeds 90%',
      cooldownMinutes: 60,
    },
  ];

  /**
   * Initialize default alert rules
   */
  static async initializeRules(): Promise<void> {
    try {
      const existingRules = await this.redis.get(this.ALERT_RULES_KEY);
      if (!existingRules) {
        await this.redis.set(this.ALERT_RULES_KEY, JSON.stringify(this.defaultRules));
      }
    } catch (error) {
      console.error('Failed to initialize alert rules:', error);
    }
  }

  /**
   * Get all alert rules
   */
  static async getAlertRules(): Promise<AlertRule[]> {
    try {
      const rules = await this.redis.get(this.ALERT_RULES_KEY);
      return rules ? JSON.parse(rules) : this.defaultRules;
    } catch (error) {
      console.error('Failed to get alert rules:', error);
      return this.defaultRules;
    }
  }

  /**
   * Update alert rules
   */
  static async updateAlertRules(rules: AlertRule[]): Promise<void> {
    try {
      await this.redis.set(this.ALERT_RULES_KEY, JSON.stringify(rules));
    } catch (error) {
      console.error('Failed to update alert rules:', error);
      throw error;
    }
  }

  /**
   * Check system health and create alerts
   */
  static async checkSystemHealth(health: SystemHealth): Promise<void> {
    const rules = await this.getAlertRules();

    for (const service of health.services) {
      await this.checkServiceAlerts(service, rules);
    }
  }

  /**
   * Check performance metrics and create alerts
   */
  static async checkPerformanceMetrics(metrics: PerformanceMetrics): Promise<void> {
    const rules = await this.getAlertRules();

    // Check API error rate
    const errorRateRule = rules.find(r => r.type === 'high_error_rate');
    if (errorRateRule?.enabled && metrics.api.errorRate > errorRateRule.threshold) {
      await this.createAlert({
        type: 'high_error_rate',
        severity: errorRateRule.severity,
        title: 'High API Error Rate',
        description: `API error rate is ${(metrics.api.errorRate * 100).toFixed(2)}%, exceeding threshold of ${(errorRateRule.threshold * 100)}%`,
        service: 'doc-api',
        value: metrics.api.errorRate,
        threshold: errorRateRule.threshold,
      });
    }

    // Check queue backlog
    const queueRule = rules.find(r => r.type === 'queue_backlog');
    if (queueRule?.enabled && metrics.queue.waiting > queueRule.threshold) {
      await this.createAlert({
        type: 'queue_backlog',
        severity: queueRule.severity,
        title: 'Document Processing Queue Backlog',
        description: `${metrics.queue.waiting} jobs waiting in queue, exceeding threshold of ${queueRule.threshold}`,
        service: 'doc-processor',
        value: metrics.queue.waiting,
        threshold: queueRule.threshold,
      });
    }

    // Check storage usage
    const storageRule = rules.find(r => r.type === 'storage_full');
    if (storageRule?.enabled && metrics.storage.totalSize > 0) {
      const usageRatio = metrics.storage.usedSize / metrics.storage.totalSize;
      if (usageRatio > storageRule.threshold) {
        await this.createAlert({
          type: 'storage_full',
          severity: storageRule.severity,
          title: 'Storage Usage Critical',
          description: `Storage usage is ${(usageRatio * 100).toFixed(1)}%, exceeding threshold of ${(storageRule.threshold * 100)}%`,
          service: 'storage',
          value: usageRatio,
          threshold: storageRule.threshold,
        });
      }
    }
  }

  /**
   * Check individual service alerts
   */
  private static async checkServiceAlerts(service: ServiceHealth, rules: AlertRule[]): Promise<void> {
    // Check service down
    if (service.status === 'unhealthy') {
      await this.createAlert({
        type: 'service_down',
        severity: 'critical',
        title: `${service.name} Service Down`,
        description: `${service.name} service is unhealthy: ${service.error || 'Unknown error'}`,
        service: service.name,
      });
    }

    // Check service response time
    const responseTimeRule = rules.find(r => r.type === 'service_slow');
    if (responseTimeRule?.enabled && service.responseTime && service.responseTime > responseTimeRule.threshold) {
      await this.createAlert({
        type: 'service_slow',
        severity: responseTimeRule.severity,
        title: `${service.name} Service Slow`,
        description: `${service.name} response time is ${service.responseTime}ms, exceeding threshold of ${responseTimeRule.threshold}ms`,
        service: service.name,
        value: service.responseTime,
        threshold: responseTimeRule.threshold,
      });
    }
  }

  /**
   * Create a new alert
   */
  private static async createAlert(alertData: Omit<Alert, 'id' | 'timestamp' | 'resolved' | 'acknowledged'>): Promise<void> {
    try {
      // Check if similar alert already exists and is not resolved
      const activeAlerts = await this.getActiveAlerts();
      const existingAlert = activeAlerts.find(alert =>
        alert.type === alertData.type &&
        alert.service === alertData.service &&
        !alert.resolved
      );

      if (existingAlert) {
        // Update existing alert timestamp
        existingAlert.timestamp = new Date();
        await this.updateAlert(existingAlert);
        return;
      }

      const alert: Alert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...alertData,
        timestamp: new Date(),
        resolved: false,
        acknowledged: false,
      };

      await this.redis.zadd(this.ALERTS_KEY, alert.timestamp.getTime(), JSON.stringify(alert));

      console.log(`Alert created: ${alert.title}`);
    } catch (error) {
      console.error('Failed to create alert:', error);
    }
  }

  /**
   * Get active alerts
   */
  static async getActiveAlerts(): Promise<Alert[]> {
    try {
      const alerts = await this.redis.zrange(this.ALERTS_KEY, 0, -1);
      return alerts.map(alert => JSON.parse(alert)).filter((alert: Alert) => !alert.resolved);
    } catch (error) {
      console.error('Failed to get active alerts:', error);
      return [];
    }
  }

  /**
   * Get alerts history
   */
  static async getAlertsHistory(limit: number = 100): Promise<Alert[]> {
    try {
      const alerts = await this.redis.zrevrange(this.ALERTS_HISTORY_KEY, 0, limit - 1);
      return alerts.map(alert => JSON.parse(alert));
    } catch (error) {
      console.error('Failed to get alerts history:', error);
      return [];
    }
  }

  /**
   * Acknowledge an alert
   */
  static async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    try {
      const alerts = await this.redis.zrange(this.ALERTS_KEY, 0, -1);
      const alertIndex = alerts.findIndex(alert => {
        const parsed = JSON.parse(alert);
        return parsed.id === alertId;
      });

      if (alertIndex !== -1) {
        const alert: Alert = JSON.parse(alerts[alertIndex]);
        alert.acknowledged = true;
        alert.acknowledgedAt = new Date();
        alert.acknowledgedBy = userId;

        await this.redis.zadd(this.ALERTS_KEY, alert.timestamp.getTime(), JSON.stringify(alert));
      }
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      throw error;
    }
  }

  /**
   * Resolve an alert
   */
  static async resolveAlert(alertId: string): Promise<void> {
    try {
      const alerts = await this.redis.zrange(this.ALERTS_KEY, 0, -1);
      const alertIndex = alerts.findIndex(alert => {
        const parsed = JSON.parse(alert);
        return parsed.id === alertId;
      });

      if (alertIndex !== -1) {
        const alert: Alert = JSON.parse(alerts[alertIndex]);
        alert.resolved = true;
        alert.resolvedAt = new Date();

        // Move to history
        await this.redis.zrem(this.ALERTS_KEY, alerts[alertIndex]);
        await this.redis.zadd(this.ALERTS_HISTORY_KEY, alert.timestamp.getTime(), JSON.stringify(alert));
      }
    } catch (error) {
      console.error('Failed to resolve alert:', error);
      throw error;
    }
  }

  /**
   * Update an alert
   */
  private static async updateAlert(alert: Alert): Promise<void> {
    try {
      // Remove old alert
      await this.redis.zremrangebyscore(this.ALERTS_KEY, alert.timestamp.getTime(), alert.timestamp.getTime());

      // Add updated alert
      await this.redis.zadd(this.ALERTS_KEY, alert.timestamp.getTime(), JSON.stringify(alert));
    } catch (error) {
      console.error('Failed to update alert:', error);
    }
  }

  /**
   * Clean up old resolved alerts (move to history and remove from active)
   */
  static async cleanupOldAlerts(): Promise<number> {
    try {
      const alerts = await this.redis.zrange(this.ALERTS_KEY, 0, -1);
      let cleaned = 0;

      for (const alertStr of alerts) {
        const alert: Alert = JSON.parse(alertStr);
        if (alert.resolved) {
          await this.redis.zrem(this.ALERTS_KEY, alertStr);
          await this.redis.zadd(this.ALERTS_HISTORY_KEY, alert.timestamp.getTime(), JSON.stringify(alert));
          cleaned++;
        }
      }

      return cleaned;
    } catch (error) {
      console.error('Failed to cleanup old alerts:', error);
      return 0;
    }
  }

  /**
   * Get alert statistics
   */
  static async getAlertStats(): Promise<{
    active: number;
    resolved: number;
    acknowledged: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
  }> {
    try {
      const activeAlerts = await this.getActiveAlerts();
      const historyAlerts = await this.getAlertsHistory(1000);

      const bySeverity: Record<string, number> = {};
      const byType: Record<string, number> = {};

      [...activeAlerts, ...historyAlerts].forEach(alert => {
        bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
        byType[alert.type] = (byType[alert.type] || 0) + 1;
      });

      return {
        active: activeAlerts.length,
        resolved: historyAlerts.filter(a => a.resolved).length,
        acknowledged: activeAlerts.filter(a => a.acknowledged).length,
        bySeverity,
        byType,
      };
    } catch (error) {
      console.error('Failed to get alert stats:', error);
      return {
        active: 0,
        resolved: 0,
        acknowledged: 0,
        bySeverity: {},
        byType: {},
      };
    }
  }
}