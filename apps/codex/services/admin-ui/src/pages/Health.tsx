import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Activity,
  Database,
  Server,
  HardDrive,
  Search,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  RefreshCw,
  Bell,
  BellOff
} from 'lucide-react';

const API_BASE_URL = '';

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  responseTime?: number;
  lastChecked: string;
  details?: Record<string, any>;
  error?: string;
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceHealth[];
  timestamp: string;
  uptime: number;
}

interface PerformanceMetrics {
  timestamp: string;
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

interface MetricsSummary {
  period: '1h' | '24h' | '7d' | '30d';
  startTime: string;
  endTime: string;
  dataPoints: number;
  averages: PerformanceMetrics;
  peaks: PerformanceMetrics;
}

interface Alert {
  id: string;
  type: 'service_down' | 'service_slow' | 'high_error_rate' | 'queue_backlog' | 'storage_full' | 'search_unavailable';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  service?: string;
  value?: number;
  threshold?: number;
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

interface AlertStats {
  active: number;
  resolved: number;
  acknowledged: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
}

export default function Health() {
  const [selectedPeriod, setSelectedPeriod] = useState<'1h' | '24h' | '7d' | '30d'>('24h');

  // Fetch system health
  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/admin/health`, {
        headers: {
        },
      });
      if (!response.ok) throw new Error('Failed to fetch system health');
      return response.json() as Promise<SystemHealth>;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch metrics summary
  const { data: metricsData, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery({
    queryKey: ['metrics-summary', selectedPeriod],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/admin/metrics/summary/${selectedPeriod}`, {
        headers: {
        },
      });
      if (!response.ok) throw new Error('Failed to fetch metrics summary');
      return response.json() as Promise<MetricsSummary>;
    },
  });

  // Fetch recent metrics
  const { data: recentMetrics, isLoading: recentLoading } = useQuery({
    queryKey: ['recent-metrics'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/admin/metrics/recent?count=20`, {
        headers: {
        },
      });
      if (!response.ok) throw new Error('Failed to fetch recent metrics');
      return response.json() as Promise<PerformanceMetrics[]>;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch active alerts
  const { data: alertsData, isLoading: alertsLoading, refetch: refetchAlerts } = useQuery({
    queryKey: ['active-alerts'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/admin/alerts`, {
        headers: {
        },
      });
      if (!response.ok) throw new Error('Failed to fetch alerts');
      return response.json() as Promise<Alert[]>;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch alert stats
  const { data: alertStats } = useQuery({
    queryKey: ['alert-stats'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/admin/alerts/stats`, {
        headers: {
        },
      });
      if (!response.ok) throw new Error('Failed to fetch alert stats');
      return response.json() as Promise<AlertStats>;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'unhealthy':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600';
      case 'unhealthy':
        return 'text-red-600';
      default:
        return 'text-yellow-600';
    }
  };

  const formatUptime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatResponseTime = (ms?: number) => {
    if (!ms) return 'N/A';
    return `${ms}ms`;
  };

  const handleRefresh = () => {
    refetchHealth();
    refetchMetrics();
    refetchAlerts();
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: {
        },
      });
      if (!response.ok) throw new Error('Failed to acknowledge alert');
      refetchAlerts();
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: {
        },
      });
      if (!response.ok) throw new Error('Failed to resolve alert');
      refetchAlerts();
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'high':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Health</h1>
          <p className="text-gray-600">Monitor system status and performance metrics</p>
        </div>
        <Button onClick={handleRefresh} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* System Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Overview
          </CardTitle>
          <CardDescription>
            Current system health status and uptime
          </CardDescription>
        </CardHeader>
        <CardContent>
          {healthLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : healthData ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(healthData.overall)}
                  <span className={`text-lg font-semibold ${getStatusColor(healthData.overall)}`}>
                    {healthData.overall.toUpperCase()}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  Uptime: {formatUptime(healthData.uptime)}
                </div>
              </div>

              {healthData.overall !== 'healthy' && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {healthData.services.filter(s => s.status !== 'healthy').length} service(s) are experiencing issues
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {healthData.services.map((service) => (
                  <Card key={service.name} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium capitalize">{service.name.replace('-', ' ')}</h3>
                      {getStatusIcon(service.status)}
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div>Status: <span className={getStatusColor(service.status)}>{service.status}</span></div>
                      <div>Response: {formatResponseTime(service.responseTime)}</div>
                      {service.error && (
                        <div className="text-red-600 text-xs truncate" title={service.error}>
                          Error: {service.error}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Unable to fetch system health. Check API connection.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Active Alerts
          </CardTitle>
          <CardDescription>
            System alerts and notifications requiring attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alertsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : alertsData && alertsData.length > 0 ? (
            <div className="space-y-4">
              {alertsData.map((alert) => (
                <div key={alert.id} className={`p-4 border rounded-lg ${getSeverityColor(alert.severity)}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4" />
                        <h3 className="font-semibold">{alert.title}</h3>
                        <Badge variant="outline" className="text-xs">
                          {alert.severity.toUpperCase()}
                        </Badge>
                        {alert.service && (
                          <Badge variant="secondary" className="text-xs">
                            {alert.service}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm mb-2">{alert.description}</p>
                      <div className="text-xs text-gray-600">
                        {new Date(alert.timestamp).toLocaleString()}
                        {alert.acknowledged && (
                          <span className="ml-2">
                            • Acknowledged by {alert.acknowledgedBy} at {new Date(alert.acknowledgedAt!).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      {!alert.acknowledged && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAcknowledgeAlert(alert.id)}
                        >
                          <BellOff className="h-3 w-3 mr-1" />
                          Acknowledge
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => handleResolveAlert(alert.id)}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Resolve
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-green-600">
              <CheckCircle className="h-12 w-12 mx-auto mb-4" />
              <p className="text-lg font-medium">All systems operational</p>
              <p className="text-sm text-gray-600">No active alerts at this time</p>
            </div>
          )}

          {alertStats && (
            <div className="mt-6 pt-4 border-t">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-gray-600">Active Alerts</div>
                  <div className="text-lg font-semibold text-red-600">{alertStats.active}</div>
                </div>
                <div>
                  <div className="text-gray-600">Acknowledged</div>
                  <div className="text-lg font-semibold text-yellow-600">{alertStats.acknowledged}</div>
                </div>
                <div>
                  <div className="text-gray-600">Resolved (24h)</div>
                  <div className="text-lg font-semibold text-green-600">{alertStats.resolved}</div>
                </div>
                <div>
                  <div className="text-gray-600">Critical</div>
                  <div className="text-lg font-semibold text-red-600">{alertStats.bySeverity.critical || 0}</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <Tabs defaultValue="24h" className="space-y-4" onValueChange={(value) => setSelectedPeriod(value as '1h' | '24h' | '7d' | '30d')}>
        <TabsList>
          <TabsTrigger value="1h">1 Hour</TabsTrigger>
          <TabsTrigger value="24h">24 Hours</TabsTrigger>
          <TabsTrigger value="7d">7 Days</TabsTrigger>
          <TabsTrigger value="30d">30 Days</TabsTrigger>
        </TabsList>
        <TabsContent value="api">
          {metricsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : metricsData ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* API Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    API Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Avg Response Time</div>
                      <div className="text-lg font-semibold">
                        {metricsData.averages.api?.averageResponseTime?.toFixed(0) || 0}ms
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Requests/min</div>
                      <div className="text-lg font-semibold">
                        {metricsData.averages.api?.requestsPerMinute?.toFixed(1) || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Error Rate</div>
                      <div className="text-lg font-semibold">
                        {(metricsData.averages.api?.errorRate * 100)?.toFixed(2) || 0}%
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Active Connections</div>
                      <div className="text-lg font-semibold">
                        {metricsData.averages.api?.activeConnections || 0}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {metricsData.dataPoints} data points • Peak response time: {metricsData.peaks.api?.averageResponseTime?.toFixed(0) || 0}ms
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Unable to fetch performance metrics. Check API connection.
            </div>
          )}
        </TabsContent>
        <TabsContent value="database">
          {metricsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : metricsData ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Database Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Database Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Connections</div>
                      <div className="text-lg font-semibold">
                        {metricsData.averages.database?.connections?.toFixed(0) || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Query Count</div>
                      <div className="text-lg font-semibold">
                        {metricsData.averages.database?.queryCount?.toFixed(0) || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Slow Queries</div>
                      <div className="text-lg font-semibold">
                        {metricsData.averages.database?.slowQueries?.toFixed(0) || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Pool Usage</div>
                      <div className="text-lg font-semibold">
                        {(metricsData.averages.database?.connectionPoolUsage * 100)?.toFixed(1) || 0}%
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Unable to fetch performance metrics. Check API connection.
            </div>
          )}
        </TabsContent>
        <TabsContent value="queue">
          {metricsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : metricsData ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Queue Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Queue Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Waiting</div>
                      <div className="text-lg font-semibold">
                        {metricsData.averages.queue?.waiting?.toFixed(0) || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Active</div>
                      <div className="text-lg font-semibold">
                        {metricsData.averages.queue?.active?.toFixed(0) || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Completed</div>
                      <div className="text-lg font-semibold">
                        {metricsData.averages.queue?.completed?.toFixed(0) || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Failed</div>
                      <div className="text-lg font-semibold text-red-600">
                        {metricsData.averages.queue?.failed?.toFixed(0) || 0}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Unable to fetch performance metrics. Check API connection.
            </div>
          )}
        </TabsContent>
        <TabsContent value="storage">
          {metricsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : metricsData ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Storage Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5" />
                    Storage Usage
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Total Size</div>
                      <div className="text-lg font-semibold">
                        {formatBytes(metricsData.averages.storage?.totalSize || 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">File Count</div>
                      <div className="text-lg font-semibold">
                        {metricsData.averages.storage?.fileCount?.toFixed(0) || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Upload Rate</div>
                      <div className="text-lg font-semibold">
                        {metricsData.averages.storage?.uploadRate?.toFixed(1) || 0}/min
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Used Space</div>
                      <div className="text-lg font-semibold">
                        {formatBytes(metricsData.averages.storage?.usedSize || 0)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Unable to fetch performance metrics. Check API connection.
            </div>
          )}
        </TabsContent>
        <TabsContent value="search">
          {metricsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : metricsData ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Search Metrics */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    Search Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Query Count</div>
                      <div className="text-lg font-semibold">
                        {metricsData.averages.search?.queryCount?.toFixed(0) || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Avg Query Time</div>
                      <div className="text-lg font-semibold">
                        {metricsData.averages.search?.averageQueryTime?.toFixed(0) || 0}ms
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Index Size</div>
                      <div className="text-lg font-semibold">
                        {formatBytes(metricsData.averages.search?.indexSize || 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Documents</div>
                      <div className="text-lg font-semibold">
                        {metricsData.averages.search?.documentCount?.toFixed(0) || 0}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Unable to fetch performance metrics. Check API connection.
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Metrics</CardTitle>
          <CardDescription>
            Latest performance data points (refreshes every minute)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : recentMetrics && recentMetrics.length > 0 ? (
            <div className="space-y-2">
              {recentMetrics.slice(-10).map((metric, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-600">
                      {new Date(metric.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="flex gap-4 text-sm">
                      <span>API: {metric.api.requestsPerMinute.toFixed(1)}/min</span>
                      <span>DB: {metric.database.connections} conn</span>
                      <span>Queue: {metric.queue.waiting} waiting</span>
                    </div>
                  </div>
                  <Badge variant={metric.api.errorRate > 0.05 ? "destructive" : "secondary"}>
                    {metric.api.errorRate > 0.05 ? "Issues" : "Normal"}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No recent metrics available. Metrics collection may not be running.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
