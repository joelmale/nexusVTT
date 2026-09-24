import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { listAuditEvents, type AuditEvent } from '@/lib/controlPlaneApi'
import { ErrorNotice, PageHeader, Pill, type Tone } from '@/components/common'
import { buttonClass, formatDate } from '@/lib/ui'

const PAGE_SIZE = 50

const OUTCOME_TONE: Record<AuditEvent['outcome'], Tone> = {
  success: 'green',
  conflict: 'yellow',
  denied: 'red',
  failure: 'red',
}

/** Read-only view of `admin_audit_events`, newest first. */
export default function Audit() {
  // `before` cursor of each page visited; the last one is the current page.
  const [cursors, setCursors] = useState<Array<string | null>>([null])
  const before = cursors[cursors.length - 1]
  const query = useQuery({
    queryKey: ['audit-events', before],
    queryFn: () => listAuditEvents({ limit: PAGE_SIZE, before }),
    placeholderData: keepPreviousData,
  })

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <PageHeader title="Audit log" description="Every control-plane mutation, denial and sign-in, newest first." />
      <ErrorNotice error={query.error} />
      {query.isLoading && <p className="text-sm text-gray-500">Loading audit events...</p>}
      {query.data && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Resource</th>
                <th className="px-3 py-2">Outcome</th>
                <th className="px-3 py-2">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {query.data.events.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                    No audit events.
                  </td>
                </tr>
              )}
              {query.data.events.map((event) => (
                <tr key={event.id} className="align-top">
                  <td className="whitespace-nowrap px-3 py-2">{formatDate(event.occurredAt)}</td>
                  <td className="px-3 py-2">
                    {event.actorEmail ?? event.actorUserId ?? '—'}
                    {event.roleUsed && <div className="text-xs text-gray-500">{event.roleUsed}</div>}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{event.action}</td>
                  <td className="px-3 py-2">
                    {event.resourceType ?? '—'}
                    {event.resourceId && <div className="break-all font-mono text-xs text-gray-500">{event.resourceId}</div>}
                    {event.priorVersion && <div className="text-xs text-gray-500">prior {event.priorVersion}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <Pill tone={OUTCOME_TONE[event.outcome] ?? 'gray'}>{event.outcome}</Pill>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {event.requestId && <div className="font-mono">req {event.requestId}</div>}
                    {event.sourceIp && <div>{event.sourceIp}</div>}
                    {event.summary && Object.keys(event.summary).length > 0 && (
                      <details>
                        <summary className="cursor-pointer">summary</summary>
                        <pre className="whitespace-pre-wrap break-all">{JSON.stringify(event.summary, null, 2)}</pre>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between">
        <button
          className={buttonClass.secondary}
          disabled={cursors.length <= 1}
          onClick={() => setCursors((current) => current.slice(0, -1))}
        >
          Newer
        </button>
        <span className="text-xs text-gray-500">Page {cursors.length}</span>
        <button
          className={buttonClass.secondary}
          disabled={!query.data?.nextCursor}
          onClick={() => setCursors((current) => [...current, query.data?.nextCursor ?? null])}
        >
          Older
        </button>
      </div>
    </div>
  )
}
