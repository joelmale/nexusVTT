import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface ProcessingLog {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  message: string;
  step?: string;
  details?: Record<string, unknown>;
}

interface QueueStats {
  waiting: number
  active: number
  completed: number
  failed: number
}

interface Job {
  id: string
  documentId: string
  documentTitle: string
  status: string
  progress: number
  attempts: number
  createdAt: number
  processedAt?: number
  finishedAt?: number
  failedReason?: string
}

interface JobsResponse {
  jobs: Job[]
  total: number
}

interface ProcessingReport {
  document: {
    id: string
    title: string
    format: string
    fileSize: number
    pageCount: number
    ocrStatus: string
    searchIndex: string | null
  }
  processing: {
    textLength?: number
    textSample?: string
    ocr?: {
      detected?: boolean
      performed?: boolean
      status?: string
      reason?: string
    }
    extraction?: {
      spells?: number
      monsters?: number
      items?: number
    }
    search?: {
      indexed?: boolean
      indexId?: string
      indexDurationMs?: number
    }
    pageImages?: {
      count?: number
      totalBytes?: number
    }
  }
}

export default function Processing() {
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [cleanDays, setCleanDays] = useState(7)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const queryClient = useQueryClient()

  // Queue stats query
  const { data: stats, isLoading: statsLoading } = useQuery<QueueStats>({
    queryKey: ['queue-stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/queue/stats')
      if (!response.ok) throw new Error('Failed to fetch queue stats')
      return response.json()
    },
    refetchInterval: autoRefresh ? 10000 : false, // Refresh every 10 seconds if enabled
  })

  // Jobs query
  const { data: jobsData, isLoading: jobsLoading } = useQuery<JobsResponse>({
    queryKey: ['queue-jobs', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter) params.append('status', statusFilter)
      params.append('limit', '100')

      const response = await fetch(`/api/admin/queue/jobs?${params}`)
      if (!response.ok) throw new Error('Failed to fetch jobs')
      return response.json()
    },
    refetchInterval: autoRefresh ? 10000 : false,
  })

  // Logs query
  const { data: logsData } = useQuery<{ jobId: string; logs: ProcessingLog[] }>({
    queryKey: ['job-logs', selectedJob?.id],
    queryFn: async () => {
      if (!selectedJob?.id) throw new Error('No job selected')
      const response = await fetch(`/api/admin/queue/jobs/${selectedJob.id}/logs`)
      if (!response.ok) throw new Error('Failed to fetch logs')
      return response.json()
    },
    enabled: !!selectedJob?.id && showErrorModal,
  })

  const { data: reportData, isLoading: reportLoading } = useQuery<ProcessingReport>({
    queryKey: ['processing-report', selectedJob?.documentId],
    queryFn: async () => {
      if (!selectedJob?.documentId) throw new Error('No document selected')
      const response = await fetch(`/api/admin/processing/report/${selectedJob.documentId}`)
      if (!response.ok) throw new Error('Failed to fetch processing report')
      return response.json()
    },
    enabled: !!selectedJob?.documentId && showDetailsModal,
  })

  // Retry job mutation
  const retryMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await fetch(`/api/admin/queue/jobs/${jobId}/retry`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to retry job')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] })
      queryClient.invalidateQueries({ queryKey: ['queue-jobs'] })
    },
  })

  // Remove job mutation
  const removeMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await fetch(`/api/admin/queue/jobs/${jobId}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to remove job')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] })
      queryClient.invalidateQueries({ queryKey: ['queue-jobs'] })
    },
  })

  // Clean jobs mutation
  const cleanMutation = useMutation({
    mutationFn: async (days: number) => {
      const response = await fetch('/api/admin/queue/clean', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ olderThanDays: days }),
      })
      if (!response.ok) throw new Error('Failed to clean jobs')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] })
      queryClient.invalidateQueries({ queryKey: ['queue-jobs'] })
    },
  })

  const getStatusBadge = (status: string) => {
    const variants = {
      waiting: 'bg-gray-100 text-gray-800',
      active: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    } as const

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    )
  }

  const getStepBadge = (status: 'ok' | 'warn' | 'error' | 'pending') => {
    const styles: Record<string, string> = {
      ok: 'bg-green-100 text-green-800',
      warn: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800',
      pending: 'bg-gray-100 text-gray-700',
    }
    return `px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`
  }

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'N/A'
    return new Date(timestamp).toLocaleString()
  }

  const handleBulkRetry = async () => {
    if (!jobsData?.jobs) return

    const failedJobs = jobsData.jobs.filter(job => job.status === 'failed')
    for (const job of failedJobs) {
      try {
        await retryMutation.mutateAsync(job.id)
      } catch (error) {
        console.error(`Failed to retry job ${job.id}:`, error)
      }
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Processing Queue</h1>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh (10s)
          </label>
          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['queue-stats'] })
              queryClient.invalidateQueries({ queryKey: ['queue-jobs'] })
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Refresh Now
          </button>
        </div>
      </div>

      {/* Queue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Waiting</h3>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-gray-900">
              {statsLoading ? '...' : stats?.waiting || 0}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Active</h3>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-blue-600">
              {statsLoading ? '...' : stats?.active || 0}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Completed</h3>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-green-600">
              {statsLoading ? '...' : stats?.completed || 0}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Failed</h3>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-red-600">
              {statsLoading ? '...' : stats?.failed || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h3 className="text-lg font-medium mb-4">Queue Management</h3>
        <div className="flex gap-4 items-center">
          <button
            onClick={handleBulkRetry}
            disabled={!jobsData?.jobs.some(job => job.status === 'failed')}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Retry All Failed Jobs
          </button>

          <div className="flex items-center gap-2">
            <label htmlFor="clean-days" className="text-sm">Clean jobs older than:</label>
            <input
              id="clean-days"
              type="number"
              min="1"
              max="365"
              value={cleanDays}
              onChange={(e) => setCleanDays(parseInt(e.target.value, 10))}
              className="w-16 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm">days</span>
            <button
              onClick={() => cleanMutation.mutate(cleanDays)}
              disabled={cleanMutation.isPending}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
            >
              {cleanMutation.isPending ? 'Cleaning...' : 'Clean Old Jobs'}
            </button>
          </div>
        </div>

        {cleanMutation.isSuccess && (
          <div className="mt-4 p-3 bg-green-100 text-green-800 rounded">
            {cleanMutation.data.message}
          </div>
        )}

        {cleanMutation.isError && (
          <div className="mt-4 p-3 bg-red-100 text-red-800 rounded">
            Failed to clean jobs: {cleanMutation.error.message}
          </div>
        )}
      </div>

      {/* Jobs Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium">
            Jobs ({jobsData?.total || 0})
          </h3>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All statuses</option>
            <option value="waiting">Waiting</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div className="p-6">
          {jobsLoading ? (
            <div className="text-center py-8">Loading jobs...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Document
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Progress
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Attempts
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {jobsData?.jobs.map((job) => (
                    <tr key={job.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {job.documentTitle}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {job.documentId}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(job.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {job.progress}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {job.attempts}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(job.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          {job.status === 'failed' && (
                            <button
                              onClick={() => retryMutation.mutate(job.id)}
                              disabled={retryMutation.isPending}
                              className="text-green-600 hover:text-green-900"
                            >
                              Retry
                            </button>
                          )}
                          <button
                            onClick={() => removeMutation.mutate(job.id)}
                            disabled={removeMutation.isPending}
                            className="text-red-600 hover:text-red-900"
                          >
                            Remove
                          </button>
                          <button
                            onClick={() => {
                              setSelectedJob(job)
                              setShowDetailsModal(true)
                            }}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            Details
                          </button>
                          {(job.failedReason || job.status === 'failed') && (
                            <button
                              onClick={() => {
                                setSelectedJob(job)
                                setShowErrorModal(true)
                              }}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              View Logs
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Error Modal */}
      {showErrorModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium">
                Processing Logs - {selectedJob.documentTitle}
              </h3>
              <button
                onClick={() => {
                  setShowErrorModal(false)
                  setSelectedJob(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {logsData?.logs && logsData.logs.length > 0 ? (
                <div className="space-y-3">
                  {logsData.logs.map((log, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded border-l-4 ${
                        log.level === 'error'
                          ? 'border-red-500 bg-red-50'
                          : log.level === 'warn'
                          ? 'border-yellow-500 bg-yellow-50'
                          : 'border-blue-500 bg-blue-50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              log.level === 'error'
                                ? 'bg-red-100 text-red-800'
                                : log.level === 'warn'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {log.level.toUpperCase()}
                            </span>
                            {log.step && (
                              <span className="text-xs text-gray-500">
                                {log.step}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-900">{log.message}</p>
                          {log.details && (
                            <details className="mt-2">
                              <summary className="text-xs text-gray-500 cursor-pointer">
                                Show details
                              </summary>
                              <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 ml-4">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No logs available for this job
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium">
                Processing Details - {selectedJob.documentTitle}
              </h3>
              <button
                onClick={() => {
                  setShowDetailsModal(false)
                  setSelectedJob(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
              {reportLoading ? (
                <div className="text-center py-8 text-gray-500">Loading processing report...</div>
              ) : reportData ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">Pipeline Steps</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span>Text extraction</span>
                          <span className={getStepBadge((reportData.processing?.textLength || 0) > 0 ? 'ok' : 'error')}>
                            {(reportData.processing?.textLength || 0) > 0 ? 'ok' : 'missing'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>OCR status</span>
                          <span className={getStepBadge(
                            reportData.processing?.ocr?.status === 'completed'
                              ? 'ok'
                              : reportData.processing?.ocr?.status === 'failed'
                              ? 'error'
                              : reportData.processing?.ocr?.status
                              ? 'warn'
                              : 'pending'
                          )}>
                            {reportData.processing?.ocr?.status || 'n/a'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Page images</span>
                          <span className={getStepBadge((reportData.processing?.pageImages?.count || 0) > 0 ? 'ok' : 'warn')}>
                            {reportData.processing?.pageImages?.count || 0}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Search indexing</span>
                          <span className={getStepBadge(reportData.processing?.search?.indexed ? 'ok' : 'error')}>
                            {reportData.processing?.search?.indexed ? 'indexed' : 'missing'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Structured data</span>
                          <span className={getStepBadge(
                            (reportData.processing?.extraction?.spells || 0) +
                            (reportData.processing?.extraction?.monsters || 0) +
                            (reportData.processing?.extraction?.items || 0) > 0 ? 'ok' : 'pending'
                          )}>
                            {(reportData.processing?.extraction?.spells || 0) +
                              (reportData.processing?.extraction?.monsters || 0) +
                              (reportData.processing?.extraction?.items || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">Text Preview</h4>
                      <p className="text-xs text-gray-500 mb-2">
                        {reportData.processing?.textLength || 0} characters
                      </p>
                      <div className="text-sm text-gray-700 whitespace-pre-wrap">
                        {reportData.processing?.textSample || 'No text sample available.'}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">No processing report available</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
