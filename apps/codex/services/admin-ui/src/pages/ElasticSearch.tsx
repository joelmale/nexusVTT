import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Progress } from '../components/ui/progress';
import {
  Database,
  RefreshCw,
  Trash2,
  BarChart3,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity
} from 'lucide-react';

interface IndexHealth {
  status: 'green' | 'yellow' | 'red';
  index: string;
  docs: {
    count: number;
    deleted: number;
  };
  store: {
    size: string;
  };
  health: string;
}

interface ClusterHealth {
  indices: Record<string, IndexHealth>;
  cluster: {
    status: string;
    nodes: number;
  };
}

interface ReindexResult {
  success: boolean;
  total: number;
  processed: number;
  failed: number;
  errors: string[];
}

const API_BASE_URL = '';

export default function ElasticSearch() {
  const [reindexProgress, setReindexProgress] = useState<ReindexResult | null>(null);
  

  // Query for cluster health
  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['elasticsearch-health'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/admin/elasticsearch/health`, {
        headers: {
        },
      });
      if (!response.ok) throw new Error('Failed to fetch health');
      return response.json() as Promise<ClusterHealth>;
    },
  });

  // Query for search stats
  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['elasticsearch-stats'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/admin/elasticsearch/stats`, {
        headers: {
        },
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
  });

  // Reindex mutation
  const reindexMutation = useMutation({
    mutationFn: async (options: { force?: boolean; batchSize?: number }) => {
      const params = new URLSearchParams();
      if (options.force) params.set('force', 'true');
      if (options.batchSize) params.set('batchSize', options.batchSize.toString());

      const response = await fetch(`${API_BASE_URL}/api/admin/elasticsearch/reindex?${params}`, {
        method: 'POST',
        headers: {
        },
      });
      if (!response.ok) throw new Error('Reindex failed');
      return response.json() as Promise<ReindexResult>;
    },
    onSuccess: (result) => {
      setReindexProgress(result);
      refetchHealth();
      refetchStats();
    },
  });

  // Recreate index mutation
  const recreateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/admin/elasticsearch/recreate-index`, {
        method: 'POST',
        headers: {
        },
      });
      if (!response.ok) throw new Error('Recreate index failed');
      return response.json();
    },
    onSuccess: () => {
      refetchHealth();
      refetchStats();
    },
  });

  // Optimize index mutation
  const optimizeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/admin/elasticsearch/optimize`, {
        method: 'POST',
        headers: {
        },
      });
      if (!response.ok) throw new Error('Optimize index failed');
      return response.json();
    },
  });

  // Clear index mutation
  const clearMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/admin/elasticsearch/clear`, {
        method: 'DELETE',
        headers: {
        },
      });
      if (!response.ok) throw new Error('Clear index failed');
      return response.json();
    },
    onSuccess: () => {
      refetchHealth();
      refetchStats();
    },
  });

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'green': return 'text-green-600';
      case 'yellow': return 'text-yellow-600';
      case 'red': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'green': return <CheckCircle className="h-4 w-4" />;
      case 'yellow': return <AlertTriangle className="h-4 w-4" />;
      case 'red': return <XCircle className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">ElasticSearch Management</h1>
        <p className="text-gray-600">Monitor and manage search index health and performance</p>
      </div>

      {/* Cluster Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Cluster Health
          </CardTitle>
          <CardDescription>
            Current status of ElasticSearch cluster and indices
          </CardDescription>
        </CardHeader>
        <CardContent>
          {healthLoading ? (
            <div>Loading...</div>
          ) : healthData ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {getStatusIcon(healthData.cluster.status)}
                  <span className={`font-medium ${getStatusColor(healthData.cluster.status)}`}>
                    Cluster: {healthData.cluster.status.toUpperCase()}
                  </span>
                </div>
                <Badge variant="outline">
                  {healthData.cluster.nodes} Node{healthData.cluster.nodes !== 1 ? 's' : ''}
                </Badge>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Indices</h4>
                {Object.values(healthData.indices).map((index) => (
                  <div key={index.index} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(index.health)}
                      <div>
                        <div className="font-medium">{index.index}</div>
                        <div className="text-sm text-gray-600">
                          {index.docs.count.toLocaleString()} documents
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{index.store.size}</div>
                      <div className="text-xs text-gray-500">
                        {index.docs.deleted} deleted
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Unable to fetch cluster health. Check ElasticSearch connection.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Search Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Search Statistics
          </CardTitle>
          <CardDescription>
            Document counts and search aggregations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div>Loading...</div>
          ) : statsData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-2xl font-bold">
                    {statsData.totalDocuments?.value?.toLocaleString() || 0}
                  </div>
                  <div className="text-sm text-gray-600">Total Documents</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {Object.keys(statsData.aggregations?.types?.buckets || {}).length}
                  </div>
                  <div className="text-sm text-gray-600">Document Types</div>
                </div>
              </div>

              {statsData.aggregations?.types?.buckets && (
                <div>
                  <h4 className="font-medium mb-2">By Type</h4>
                  <div className="space-y-1">
                    {statsData.aggregations.types.buckets.map((bucket: any) => (
                      <div key={bucket.key} className="flex justify-between">
                        <span className="capitalize">{bucket.key}</span>
                        <Badge variant="secondary">{bucket.doc_count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>No statistics available</div>
          )}
        </CardContent>
      </Card>

      {/* Index Management Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Index Management</CardTitle>
          <CardDescription>
            Maintenance operations for search indices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={() => reindexMutation.mutate({})}
              disabled={reindexMutation.isPending}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reindex Documents
            </Button>

            <Button
              onClick={() => reindexMutation.mutate({ force: true })}
              disabled={reindexMutation.isPending}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Force Reindex All
            </Button>

            <Button
              onClick={() => optimizeMutation.mutate()}
              disabled={optimizeMutation.isPending}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Activity className="h-4 w-4" />
              Optimize Index
            </Button>

            <Button
              onClick={() => recreateMutation.mutate()}
              disabled={recreateMutation.isPending}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <Database className="h-4 w-4" />
              Recreate Index
            </Button>

            <Button
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear Index
            </Button>

            <Button
              onClick={() => {
                refetchHealth();
                refetchStats();
              }}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reindex Progress */}
      {reindexMutation.isPending && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Reindexing Progress</span>
                <span>Running...</span>
              </div>
              <Progress value={undefined} className="animate-pulse" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reindex Results */}
      {reindexProgress && (
        <Card>
          <CardHeader>
            <CardTitle>Reindex Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{reindexProgress.total}</div>
                  <div className="text-sm text-gray-600">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{reindexProgress.processed}</div>
                  <div className="text-sm text-gray-600">Processed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{reindexProgress.failed}</div>
                  <div className="text-sm text-gray-600">Failed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {reindexProgress.success ? 'Success' : 'Failed'}
                  </div>
                  <div className="text-sm text-gray-600">Status</div>
                </div>
              </div>

              {reindexProgress.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium">Errors:</div>
                    <ul className="list-disc list-inside mt-1">
                      {reindexProgress.errors.slice(0, 5).map((error, index) => (
                        <li key={index} className="text-sm">{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Operation Status Messages */}
      {recreateMutation.isSuccess && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>Index recreated successfully</AlertDescription>
        </Alert>
      )}

      {optimizeMutation.isSuccess && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>Index optimized successfully</AlertDescription>
        </Alert>
      )}

      {clearMutation.isSuccess && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>Index cleared successfully</AlertDescription>
        </Alert>
      )}

      {/* Error Messages */}
      {reindexMutation.isError && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            Reindex failed: {reindexMutation.error?.message}
          </AlertDescription>
        </Alert>
      )}

      {recreateMutation.isError && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            Recreate index failed: {recreateMutation.error?.message}
          </AlertDescription>
        </Alert>
      )}

      {optimizeMutation.isError && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            Optimize index failed: {optimizeMutation.error?.message}
          </AlertDescription>
        </Alert>
      )}

      {clearMutation.isError && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            Clear index failed: {clearMutation.error?.message}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
