import { useEffect, useRef, useState, type ReactNode } from 'react'
import { KIND_MARK, sourceTag } from './console'
import type { ProcessingEvent } from './types'

/** Screen readers get at most one batch of new lines per interval. */
export const FEED_FLUSH_MS = 2000

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour12: false })

export interface ActionFeedProps {
  events: ProcessingEvent[]
  /** Today's raw job-log panel, shown by the "Raw logs" toggle. */
  rawLogs?: ReactNode
  /** Pinned status line (GPU telemetry). */
  statusLine?: ReactNode
  /** Shown next to the title, e.g. the active step filter. */
  filterLabel?: string
  onClearFilter?: () => void
}

/**
 * Human-readable processing sentences, newest last. The list is an ARIA log
 * (polite); new lines are appended in batches at most every FEED_FLUSH_MS so a
 * five-page layout burst is one announcement, not ten.
 */
export function ActionFeed({ events, rawLogs, statusLine, filterLabel, onClearFilter }: ActionFeedProps) {
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
    <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950 text-slate-200" aria-labelledby="action-feed-title">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <h3 id="action-feed-title" className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-300">
            Action console
          </h3>
          {filterLabel && (
            <button
              type="button"
              onClick={onClearFilter}
              className="rounded border border-indigo-400/60 px-1.5 font-mono text-[10px] text-indigo-300 hover:bg-indigo-500/10"
              aria-label={`Showing ${filterLabel} only; show all`}
            >
              {filterLabel} ✕
            </button>
          )}
        </div>
        {rawLogs && (
          <button
            type="button"
            aria-pressed={showRaw}
            onClick={() => setShowRaw((value) => !value)}
            className="rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800"
          >
            Raw logs
          </button>
        )}
      </div>
      {statusLine && <div className="border-b border-slate-800 px-3 py-1.5 font-mono text-[11px] text-lime-300">{statusLine}</div>}
      {showRaw && rawLogs ? (
        <div className="max-h-72 overflow-y-auto bg-white p-3 text-gray-900">{rawLogs}</div>
      ) : (
        <ol
          ref={listRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Processing events"
          className="max-h-72 space-y-1 overflow-y-auto p-3 font-mono text-xs"
        >
          {shown.length === 0 && <li className="text-slate-500">No events yet.</li>}
          {shown.map((event) => {
            const tag = sourceTag(event)
            const mark = KIND_MARK[event.kind]
            return (
              <li key={event.id} className="flex gap-2" data-kind={event.kind}>
                <time className="shrink-0 text-slate-500" dateTime={event.createdAt}>
                  {time(event.createdAt)}
                </time>
                <span className={`shrink-0 whitespace-nowrap rounded border px-1 text-[10px] font-semibold ${tag.className}`}>{tag.label}:</span>
                {mark && <span className="shrink-0 rounded border border-red-500 px-1 text-[10px] font-semibold text-red-300">{mark}</span>}
                <span className={event.kind === 'stage_failed' ? 'text-red-300' : event.kind === 'telemetry' ? 'text-lime-200' : 'text-slate-100'}>
                  {event.message}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
