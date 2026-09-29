import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ProcessingEvent } from './types'

/** Screen readers get at most one batch of new lines per interval. */
export const FEED_FLUSH_MS = 2000

const SOURCE_TAGS: Record<string, { label: string; className: string }> = {
  ingest: { label: 'INGEST', className: 'bg-slate-100 text-slate-700 border-slate-300' },
  render: { label: 'RENDER', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  ocr: { label: 'OCR', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  layout: { label: 'LAYOUT', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  extract: { label: 'EXTRACT', className: 'bg-purple-50 text-purple-700 border-purple-200' },
  index: { label: 'INDEX', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  assets: { label: 'ASSETS', className: 'bg-pink-50 text-pink-700 border-pink-200' },
}

const KIND_MARK: Partial<Record<ProcessingEvent['kind'], string>> = {
  stage_failed: 'FAILED',
  entity_rejected: 'REJECTED',
}

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour12: false })

export interface ActionFeedProps {
  events: ProcessingEvent[]
  /** Today's raw job-log panel, shown by the "Raw logs" toggle. */
  rawLogs?: ReactNode
}

/**
 * Human-readable processing sentences, newest last. The list is an ARIA log
 * (polite); new lines are appended in batches at most every FEED_FLUSH_MS so a
 * five-page layout burst is one announcement, not ten.
 */
export function ActionFeed({ events, rawLogs }: ActionFeedProps) {
  const [shown, setShown] = useState<ProcessingEvent[]>(events)
  const [showRaw, setShowRaw] = useState(false)
  const lastFlush = useRef(0)
  const listRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    // A shorter list means a new run or a replay restart: show it at once.
    if (events.length < shown.length || shown.length === 0) {
      setShown(events)
      lastFlush.current = Date.now()
      return
    }
    if (events.length === shown.length) return
    const wait = Math.max(0, lastFlush.current + FEED_FLUSH_MS - Date.now())
    const timer = setTimeout(() => {
      lastFlush.current = Date.now()
      setShown(events)
    }, wait)
    return () => clearTimeout(timer)
  }, [events, shown.length])

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [shown.length])

  return (
    <section className="rounded-lg border border-gray-200 bg-white" aria-labelledby="action-feed-title">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <h3 id="action-feed-title" className="text-sm font-semibold text-gray-900">
          Action feed
        </h3>
        {rawLogs && (
          <button
            type="button"
            aria-pressed={showRaw}
            onClick={() => setShowRaw((value) => !value)}
            className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50"
          >
            Raw logs
          </button>
        )}
      </div>
      {showRaw && rawLogs ? (
        <div className="max-h-72 overflow-y-auto p-3">{rawLogs}</div>
      ) : (
        <ol
          ref={listRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Processing events"
          className="max-h-72 space-y-1 overflow-y-auto p-3 font-mono text-xs"
        >
          {shown.length === 0 && <li className="text-gray-400">No events yet.</li>}
          {shown.map((event) => {
            const tag = SOURCE_TAGS[event.stage] ?? { label: event.stage.toUpperCase(), className: 'bg-gray-100 text-gray-700 border-gray-300' }
            const mark = KIND_MARK[event.kind]
            return (
              <li key={event.id} className="flex gap-2" data-kind={event.kind}>
                <time className="shrink-0 text-gray-400" dateTime={event.createdAt}>
                  {time(event.createdAt)}
                </time>
                <span className={`shrink-0 rounded border px-1 text-[10px] font-semibold ${tag.className}`}>{tag.label}</span>
                {mark && <span className="shrink-0 rounded border border-red-300 bg-red-50 px-1 text-[10px] font-semibold text-red-700">{mark}</span>}
                <span className={event.kind === 'stage_failed' ? 'text-red-700' : 'text-gray-800'}>{event.message}</span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
