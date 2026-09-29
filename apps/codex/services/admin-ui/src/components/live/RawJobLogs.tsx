import { useQuery } from '@tanstack/react-query'
import { codexFetch } from '@/lib/api'

interface ProcessingLog {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical'
  message: string
  step?: string
}

/** Today's raw job log (Redis), behind the Action Feed's "Raw logs" toggle. Loads when shown. */
export function RawJobLogs({ jobId }: { jobId: string | null | undefined }) {
  const { data, isLoading } = useQuery<{ logs: ProcessingLog[] }>({
    queryKey: ['job-logs', jobId],
    queryFn: async () => {
      const response = await codexFetch(`/api/admin/queue/jobs/${jobId}/logs`)
      if (!response.ok) throw new Error('Failed to fetch logs')
      return response.json()
    },
    enabled: Boolean(jobId),
  })

  if (!jobId) return <p className="text-xs text-gray-500">No job selected for this document.</p>
  if (isLoading) return <p className="text-xs text-gray-500">Loading logs…</p>
  if (!data?.logs?.length) return <p className="text-xs text-gray-500">No logs available for this job.</p>

  return (
    <ol className="space-y-1 font-mono text-[11px]">
      {data.logs.map((log, index) => (
        <li key={index} className={log.level === 'error' || log.level === 'critical' ? 'text-red-700' : log.level === 'warn' ? 'text-amber-700' : 'text-gray-700'}>
          <span className="text-gray-400">{new Date(log.timestamp).toLocaleTimeString()}</span> [{log.level.toUpperCase()}]
          {log.step ? ` ${log.step}:` : ''} {log.message}
        </li>
      ))}
    </ol>
  )
}
