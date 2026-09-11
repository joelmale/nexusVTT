import { useQuery } from '@tanstack/react-query'

interface Stats {
  totalDocuments: number
  processingCount: number
  failedCount: number
  totalStorageBytes: number
  documentsByType: Record<string, number>
  recentUploads: Array<{
    id: string
    title: string
    createdAt: string
    status: string
  }>
  processingQueue: {
    waiting: number
    active: number
    completed: number
    failed: number
  }
}

export default function Dashboard() {
  const { data: stats, isLoading, error } = useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/stats')
      if (!response.ok) throw new Error('Failed to fetch stats')
      return response.json()
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return '0 B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      processing: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      indexed: 'bg-blue-100 text-blue-800',
    } as const

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-600">Error loading dashboard: {error.message}</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {isLoading ? (
        <div className="text-center py-8">Loading dashboard...</div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Stats Cards */}
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-500">Total Documents</h3>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-gray-900">{stats.totalDocuments}</div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-500">Processing</h3>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-yellow-600">{stats.processingCount}</div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-500">Failed</h3>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-red-600">{stats.failedCount}</div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-500">Storage Used</h3>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-gray-900">{formatFileSize(stats.totalStorageBytes)}</div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Document Types Chart */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-4">Documents by Type</h3>
          {stats ? (
            <div className="space-y-2">
              {Object.entries(stats.documentsByType).map(([type, count]) => (
                <div key={type} className="flex justify-between">
                  <span className="capitalize">{type.replace('_', ' ')}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">No data available</div>
          )}
        </div>

        {/* Processing Queue Status */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-4">Processing Queue</h3>
          {stats ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Waiting</span>
                <span className="font-medium">{stats.processingQueue.waiting}</span>
              </div>
              <div className="flex justify-between">
                <span>Active</span>
                <span className="font-medium">{stats.processingQueue.active}</span>
              </div>
              <div className="flex justify-between">
                <span>Completed</span>
                <span className="font-medium text-green-600">{stats.processingQueue.completed}</span>
              </div>
              <div className="flex justify-between">
                <span>Failed</span>
                <span className="font-medium text-red-600">{stats.processingQueue.failed}</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">No data available</div>
          )}
        </div>

        {/* Recent Uploads */}
        <div className="bg-white p-6 rounded-lg shadow lg:col-span-2">
          <h3 className="text-lg font-medium mb-4">Recent Uploads</h3>
          {stats && stats.recentUploads.length > 0 ? (
            <div className="space-y-4">
              {stats.recentUploads.map((upload) => (
                <div key={upload.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{upload.title}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(upload.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {getStatusBadge(upload.status)}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">No recent uploads</div>
          )}
        </div>
      </div>
    </div>
  )
}