import { useState } from 'react'
import { codexFetch } from '@/lib/api'
import { useCan } from '@/auth/AuthContext'
import { permissionHint } from '@/auth/permissions'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PipelineGraph from '@/components/PipelineGraph'

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
  stage?: string
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
  const canRetry = useCan('retryJob')
  const canRemove = useCan('removeJob')
  const canClean = useCan('cleanQueue')

  // Queue stats query
  const { data: stats, isLoading: statsLoading } = useQuery<QueueStats>({
    queryKey: ['queue-stats'],
    queryFn: async () => {
      const response = await codexFetch('/api/admin/queue/stats')
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

      const response = await codexFetch(`/api/admin/queue/jobs?${params}`)
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
      const response = await codexFetch(`/api/admin/queue/jobs/${selectedJob.id}/logs`)
      if (!response.ok) throw new Error('Failed to fetch logs')
      return response.json()
    },
    enabled: !!selectedJob?.id && showErrorModal,
  })

  const activeOrFailedJob = jobsData?.jobs?.find((j) => j.status === 'active') || jobsData?.jobs?.find((j) => j.status === 'failed') || jobsData?.jobs?.[0]
  const currentInspectJob = selectedJob || activeOrFailedJob || null

  const { data: reportData, isLoading: reportLoading } = useQuery<ProcessingReport>({
    queryKey: ['processing-report', currentInspectJob?.documentId],
    queryFn: async () => {
      if (!currentInspectJob?.documentId) throw new Error('No document selected')
      const response = await codexFetch(`/api/admin/processing/report/${currentInspectJob.documentId}`)
      if (!response.ok) throw new Error('Failed to fetch processing report')
      return response.json()
    },
    enabled: !!currentInspectJob?.documentId,
    refetchInterval: autoRefresh ? 10000 : false,
  })

  // Retry job mutation
  const retryMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await codexFetch(`/api/admin/queue/jobs/${jobId}/retry`, {
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
      const response = await codexFetch(`/api/admin/queue/jobs/${jobId}`, {
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
      const response = await codexFetch('/api/admin/queue/clean', {
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

      {/* ComfyUI Pipeline Graph Hero Section */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span>Pipeline Architecture & Live Status</span>
              <span className="text-xs font-normal px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                Visual Graph
              </span>
            </h2>
            <p className="text-xs text-gray-500">
              Interactive node-flow diagram showing document ingestion, layout detection, GPU OCR sidecar, entity extraction, search indexing, and asset generation.
            </p>
          </div>

          {jobsData?.jobs && jobsData.jobs.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <label htmlFor="pipeline-job-select" className="text-gray-500 font-medium">
                Viewing Document:
              </label>
              <select
                id="pipeline-job-select"
                value={currentInspectJob?.id || ''}
                onChange={(e) => {
                  const job = jobsData.jobs.find((j) => j.id === e.target.value)
                  if (job) setSelectedJob(job)
                }}
                className="px-2.5 py-1.5 border border-gray-300 rounded-md bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-xs truncate"
              >
                {jobsData.jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.documentTitle} ({job.stage || 'queued'} - {job.status})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <PipelineGraph
          documentTitle={currentInspectJob?.documentTitle || 'No Document Selected'}
          documentId={currentInspectJob?.documentId}
          format={reportData?.document?.format || 'PDF'}
          fileSize={reportData?.document?.fileSize || 0}
          pageCount={reportData?.document?.pageCount || 0}
          searchIndex={reportData?.document?.searchIndex}
          currentStage={currentInspectJob?.stage}
          jobStatus={currentInspectJob?.status}
          reportProcessing={reportData?.processing}
          onRetryStage={canRetry && currentInspectJob ? () => retryMutation.mutate(currentInspectJob.id) : undefined}
          isLoading={reportLoading}
        />
      </div>

      {/* Controls */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h3 className="text-lg font-medium mb-4">Queue Management</h3>
        <div className="flex gap-4 items-center">
          <button
            onClick={handleBulkRetry}
            disabled={!canRetry || !jobsData?.jobs.some(job => job.status === 'failed')}
            title={canRetry ? undefined : permissionHint('retryJob')}
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
              disabled={!canClean || cleanMutation.isPending}
              title={canClean ? undefined : permissionHint('cleanQueue')}
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
                  {jobsData?.jobs.map((job) => {
                    const isInspected = currentInspectJob?.id === job.id
                    return (
                      <tr
                        key={job.id}
                        onClick={() => setSelectedJob(job)}
                        className={`cursor-pointer transition-colors ${
                          isInspected ? 'bg-indigo-50/70 border-l-4 border-indigo-600' : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                              <span>{job.documentTitle}</span>
                              {job.stage && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider bg-blue-100 text-blue-800">
                                  {job.stage}
                                </span>
                              )}
                              {isInspected && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-700">
                                  Visualizing
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 font-mono text-xs">
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
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedJob(job)
                              }}
                              className={`px-2 py-1 rounded text-xs font-medium transition ${
                                isInspected
                                  ? 'bg-indigo-600 text-white font-semibold'
                                  : 'text-indigo-600 hover:bg-indigo-50 border border-indigo-200'
                              }`}
                            >
                              {isInspected ? 'Inspecting' : 'Inspect'}
                            </button>
                            {job.status === 'failed' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  retryMutation.mutate(job.id)
                                }}
                                disabled={!canRetry || retryMutation.isPending}
                                title={canRetry ? undefined : permissionHint('retryJob')}
                                className="text-green-600 hover:text-green-900 disabled:opacity-50 text-xs"
                              >
                                Retry
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                removeMutation.mutate(job.id)
                              }}
                              disabled={!canRemove || removeMutation.isPending}
                              title={canRemove ? undefined : permissionHint('removeJob')}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50 text-xs"
                            >
                              Remove
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedJob(job)
                                setShowDetailsModal(true)
                              }}
                              className="text-indigo-600 hover:text-indigo-900 text-xs"
                            >
                              Details
                            </button>
                            {(job.failedReason || job.status === 'failed') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedJob(job)
                                  setShowErrorModal(true)
                                }}
                                className="text-blue-600 hover:text-blue-900 text-xs"
                              >
                                View Logs
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
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
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <span>Pipeline Details - {selectedJob.documentTitle}</span>
                  {selectedJob.stage && (
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold uppercase tracking-wider">
                      {selectedJob.stage}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-gray-500 font-mono">Document ID: {selectedJob.documentId}</p>
              </div>
              <button
                onClick={() => {
                  setShowDetailsModal(false)
                }}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200 transition"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[75vh] space-y-6">
              {reportLoading ? (
                <div className="text-center py-12 text-gray-500">Loading processing report...</div>
              ) : (
                <>
                  <PipelineGraph
                    documentTitle={selectedJob.documentTitle}
                    documentId={selectedJob.documentId}
                    format={reportData?.document?.format || 'PDF'}
                    fileSize={reportData?.document?.fileSize || 0}
                    pageCount={reportData?.document?.pageCount || 0}
                    searchIndex={reportData?.document?.searchIndex}
                    currentStage={selectedJob.stage}
                    jobStatus={selectedJob.status}
                    reportProcessing={reportData?.processing}
                    onRetryStage={canRetry ? () => retryMutation.mutate(selectedJob.id) : undefined}
                    isLoading={reportLoading}
                  />

                  {reportData?.processing?.textSample && (
                    <div className="border rounded-xl p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-sm text-gray-900">Extracted Text Preview</h4>
                        <span className="text-xs font-mono text-gray-500">
                          {reportData.processing.textLength || 0} characters
                        </span>
                      </div>
                      <div className="text-xs font-mono text-gray-700 bg-white p-3 rounded-lg border max-h-48 overflow-y-auto whitespace-pre-wrap">
                        {reportData.processing.textSample}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
