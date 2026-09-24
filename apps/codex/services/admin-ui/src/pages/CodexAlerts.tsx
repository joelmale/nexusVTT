import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { codexFetch } from '@/lib/api'
import { useCan } from '@/auth/AuthContext'
import { permissionHint } from '@/auth/permissions'
import { ErrorNotice, Pill, Section, type Tone } from '@/components/common'
import { buttonClass, formatDate } from '@/lib/ui'

interface CodexAlert {
  id: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  service?: string
  timestamp: string
  acknowledged: boolean
  acknowledgedAt?: string
  acknowledgedBy?: string
}

const SEVERITY_TONE: Record<CodexAlert['severity'], Tone> = {
  critical: 'red',
  high: 'red',
  medium: 'yellow',
  low: 'blue',
}

/**
 * Codex's own alert list (acknowledge/resolve). The fake Codex performance
 * metrics from the old Health page are intentionally not shown; platform
 * telemetry comes from the operations summary above.
 */
export default function CodexAlerts() {
  const queryClient = useQueryClient()
  const canManageAlerts = useCan('manageAlerts')
  const { data, error, isLoading } = useQuery({
    queryKey: ['codex-alerts'],
    queryFn: async () => {
      const response = await codexFetch('/api/admin/alerts')
      if (!response.ok) throw new Error('Failed to fetch Codex alerts')
      return (await response.json()) as CodexAlert[]
    },
    refetchInterval: 30_000,
  })

  const action = useMutation({
    mutationFn: async ({ id, kind }: { id: string; kind: 'acknowledge' | 'resolve' }) => {
      const response = await codexFetch(`/api/admin/alerts/${encodeURIComponent(id)}/${kind}`, { method: 'POST' })
      if (!response.ok) throw new Error(`Failed to ${kind} alert`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['codex-alerts'] }),
  })

  const alerts = Array.isArray(data) ? data : []

  return (
    <Section title="Codex alerts">
      <ErrorNotice error={error ?? action.error} />
      {isLoading && <p className="text-sm text-gray-500">Loading Codex alerts...</p>}
      {!isLoading && alerts.length === 0 && <p className="text-sm text-gray-500">No active Codex alerts.</p>}
      <ul className="divide-y divide-gray-100">
        {alerts.map((alert) => (
          <li key={alert.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{alert.title}</span>
                <Pill tone={SEVERITY_TONE[alert.severity] ?? 'gray'}>{alert.severity}</Pill>
                {alert.service && <Pill>{alert.service}</Pill>}
              </div>
              <p className="text-sm text-gray-700">{alert.description}</p>
              <p className="text-xs text-gray-500">
                {formatDate(alert.timestamp)}
                {alert.acknowledged && ` · acknowledged by ${alert.acknowledgedBy ?? 'unknown'} ${formatDate(alert.acknowledgedAt)}`}
              </p>
            </div>
            <div className="flex gap-2">
              {!alert.acknowledged && (
                <button
                  className={buttonClass.secondary}
                  disabled={!canManageAlerts || action.isPending}
                  title={canManageAlerts ? undefined : permissionHint('manageAlerts')}
                  onClick={() => action.mutate({ id: alert.id, kind: 'acknowledge' })}
                >
                  Acknowledge
                </button>
              )}
              <button
                className={buttonClass.secondary}
                disabled={!canManageAlerts || action.isPending}
                title={canManageAlerts ? undefined : permissionHint('manageAlerts')}
                onClick={() => action.mutate({ id: alert.id, kind: 'resolve' })}
              >
                Resolve
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  )
}
