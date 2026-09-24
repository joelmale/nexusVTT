import { useQuery } from '@tanstack/react-query'
import { getOperationsSummary, type OperationsSummary, type ServiceStatus } from '@/lib/controlPlaneApi'
import { ErrorNotice, PageHeader, Pill, Section, type Tone } from '@/components/common'
import { buttonClass, formatDate } from '@/lib/ui'
import CodexAlerts from './CodexAlerts'
import { useCan } from '@/auth/AuthContext'

/** Operations summary refresh interval. */
const OPERATIONS_REFRESH_MS = 30_000

const STATUS_TONE: Record<ServiceStatus, Tone> = {
  up: 'green',
  degraded: 'yellow',
  down: 'red',
  unknown: 'gray',
}

const STATUS_LABEL: Record<ServiceStatus, string> = {
  up: 'Up',
  degraded: 'Degraded',
  down: 'Down',
  unknown: 'Unknown',
}

function normalizeStatus(value: unknown): ServiceStatus {
  return value === 'up' || value === 'degraded' || value === 'down' ? value : 'unknown'
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86_400) return `${(seconds / 3600).toFixed(1)}h`
  return `${(seconds / 86_400).toFixed(1)}d`
}

type MetricKey = keyof OperationsSummary['metrics']

/** Only metrics control-api actually reports are shown; there are no placeholders. */
const METRICS: Array<{ key: MetricKey; label: string; format: (value: number) => string }> = [
  { key: 'activeRooms', label: 'Active VTT rooms', format: (v) => v.toLocaleString() },
  { key: 'websocketConnections', label: 'WebSocket connections', format: (v) => v.toLocaleString() },
  { key: 'commitP95Ms', label: 'State commit p95', format: (v) => `${Math.round(v)} ms` },
  { key: 'codexQueueWaiting', label: 'Codex jobs waiting', format: (v) => v.toLocaleString() },
  { key: 'codexQueueFailed', label: 'Codex jobs failed', format: (v) => v.toLocaleString() },
  { key: 'assetMissingFiles', label: 'Asset files missing', format: (v) => v.toLocaleString() },
  { key: 'assetManifestAgeSeconds', label: 'Asset manifest age', format: formatDuration },
]

function severityTone(severity: string): Tone {
  const value = severity.toLowerCase()
  if (value === 'critical' || value === 'page') return 'red'
  if (value === 'warning' || value === 'high') return 'yellow'
  return 'blue'
}

/** Only http(s) links are rendered, so a bad summary cannot inject a javascript: URL. */
function safeHref(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url, window.location.origin)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null
  } catch {
    return null
  }
}

export default function Operations() {
  const canReadCodex = useCan('viewDocuments')
  const { data, error, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['operations-summary'],
    queryFn: getOperationsSummary,
    refetchInterval: OPERATIONS_REFRESH_MS,
  })

  const services = data?.services ?? []
  const metrics = METRICS.filter(({ key }) => typeof data?.metrics?.[key] === 'number' && Number.isFinite(data.metrics[key]))
  const alerts = data?.alerts ?? []
  const grafana = safeHref(data?.links?.grafana)
  const runbooks = (data?.links?.runbooks ?? [])
    .map((runbook) => ({ ...runbook, href: safeHref(runbook.url) }))
    .filter((runbook): runbook is { title: string; url: string; href: string } => runbook.href !== null)

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <PageHeader
        title="Operations"
        description="Platform status from Prometheus via control-api. Refreshes every 30 seconds."
        actions={
          <button className={buttonClass.secondary} onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? 'Refreshing...' : 'Refresh'}
          </button>
        }
      />
      {data && (
        <p className="text-xs text-gray-500" data-testid="ops-generated-at">
          Generated {formatDate(data.generatedAt)}
          {dataUpdatedAt ? ` · fetched ${new Date(dataUpdatedAt).toLocaleTimeString()}` : ''}
        </p>
      )}
      <ErrorNotice error={error} />
      {isLoading && <p className="text-sm text-gray-500">Loading operations summary...</p>}

      {data && (
        <>
          <Section title="Services">
            {services.length === 0 ? (
              <p className="text-sm text-gray-500">No service status reported.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Service status">
                {services.map((service) => {
                  const status = normalizeStatus(service.status)
                  return (
                    <li key={service.name} className="rounded-md border border-gray-200 p-3" data-testid={`service-${service.name}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-gray-900">{service.name}</span>
                        <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>
                      </div>
                      {service.detail && <p className="mt-1 text-xs text-gray-600">{service.detail}</p>}
                      {status === 'unknown' && !service.detail && (
                        <p className="mt-1 text-xs text-gray-500">No data from monitoring.</p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Section>

          <Section title="Key metrics">
            {metrics.length === 0 ? (
              <p className="text-sm text-gray-500">Monitoring reported no metrics.</p>
            ) : (
              <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {metrics.map(({ key, label, format }) => (
                  <div key={key} className="rounded-md bg-gray-50 p-3" data-testid={`metric-${key}`}>
                    <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
                    <dd className="mt-1 text-xl font-semibold text-gray-900">{format(data.metrics[key] as number)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Section>

          <Section title={`Firing alerts (${alerts.length})`}>
            {alerts.length === 0 ? (
              <p className="text-sm text-gray-500">No alerts are firing.</p>
            ) : (
              <ul className="divide-y divide-gray-100" aria-label="Firing alerts">
                {alerts.map((alert) => (
                  <li key={`${alert.name}-${alert.since}`} className="flex items-center justify-between gap-3 py-2">
                    <span className="font-medium text-gray-900">{alert.name}</span>
                    <span className="flex items-center gap-2 text-xs text-gray-600">
                      <Pill tone={severityTone(alert.severity)}>{alert.severity}</Pill>
                      since {formatDate(alert.since)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Dashboards and runbooks">
            <ul className="space-y-1 text-sm">
              {grafana ? (
                <li>
                  <a className="text-indigo-600 hover:text-indigo-800" href={grafana} target="_blank" rel="noreferrer noopener">
                    Grafana dashboards
                  </a>
                </li>
              ) : (
                <li className="text-gray-500">Grafana link not configured.</li>
              )}
              {runbooks.map((runbook) => (
                <li key={runbook.href}>
                  <a className="text-indigo-600 hover:text-indigo-800" href={runbook.href} target="_blank" rel="noreferrer noopener">
                    {runbook.title}
                  </a>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}

      {canReadCodex && <CodexAlerts />}
    </div>
  )
}
