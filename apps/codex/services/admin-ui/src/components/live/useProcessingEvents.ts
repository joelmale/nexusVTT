import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { codexFetch, codexUrl } from '@/lib/api'
import { derivePipelineSteps } from './pipeline'
import type {
  CandidateState,
  EventsResponse,
  ExtractedEntityPayload,
  GpuTelemetry,
  ProcessingEvent,
  ProcessingRun,
} from './types'

export const LIVE_POLL_MS = 1500
const PAGE_LIMIT = 200
/** Stream messages arrive one by one; commit them to state in small batches. */
export const STREAM_BATCH_MS = 100

async function fetchEvents(documentId: string, params: { after?: string | null; runId?: string | null }): Promise<EventsResponse> {
  const query = new URLSearchParams({ limit: String(PAGE_LIMIT) })
  if (params.after) query.set('after', params.after)
  if (params.runId) query.set('runId', params.runId)
  const response = await codexFetch(`/api/admin/processing/${documentId}/events?${query}`)
  if (!response.ok) throw new Error('Failed to load processing events')
  return response.json()
}

/**
 * Event stream for one document.
 *
 * Live mode: loads the run once, then, while `active`, follows it over
 * Server-Sent Events (control-api `.../stream`, woken by the pipeline's Redis
 * publish). The stream resumes by event id, so a reconnect never skips or
 * repeats an event. Without EventSource, or when the stream cannot be opened,
 * it polls `?after=<last id>` every 1.5 s instead.
 * Replay mode: loads every event of `replayRunId`, then reveals them one at a
 * time on a timer that the caller controls (`replay.step`, `replay.play`).
 */
export function useProcessingEvents(documentId: string | null, options: { active: boolean; replayRunId?: string | null }) {
  const { active, replayRunId } = options
  const [events, setEvents] = useState<ProcessingEvent[]>([])
  const [runs, setRuns] = useState<ProcessingRun[]>([])
  const [runId, setRunId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [transport, setTransport] = useState<'idle' | 'stream' | 'poll'>('idle')
  const cursor = useRef<string | null>(null)
  const runRef = useRef<string | null>(null)
  const loading = useRef(false)

  // Replay state
  const [replayEvents, setReplayEvents] = useState<ProcessingEvent[]>([])
  const [replayIndex, setReplayIndex] = useState(0)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    setEvents([])
    setRuns([])
    setRunId(null)
    cursor.current = null
    runRef.current = null
  }, [documentId])

  const poll = useCallback(async () => {
    if (!documentId || loading.current) return
    loading.current = true
    try {
      // Collect everything new, then commit once (updaters stay pure).
      const fresh: ProcessingEvent[] = []
      let reset = false
      for (;;) {
        const page = await fetchEvents(documentId, { after: cursor.current })
        if (page.runs) setRuns(page.runs)
        if (page.runId) {
          if (runRef.current && page.runId !== runRef.current) {
            // A new run started (reprocess): start the stream over.
            reset = true
            fresh.length = 0
          }
          runRef.current = page.runId
        }
        fresh.push(...page.events)
        cursor.current = page.nextAfter
        if (!page.hasMore) break
      }
      setRunId(runRef.current)
      if (reset) setEvents(fresh)
      else if (fresh.length > 0) setEvents((existing) => [...existing, ...fresh])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      loading.current = false
    }
  }, [documentId])

  // Initial load, then the live stream (or polling) while a job is active.
  useEffect(() => {
    if (!documentId || replayRunId) return
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | undefined
    let source: EventSource | undefined
    let flushTimer: ReturnType<typeof setTimeout> | undefined
    const pending: ProcessingEvent[] = []

    const startPolling = () => {
      if (cancelled || timer) return
      setTransport('poll')
      timer = setInterval(() => void poll(), LIVE_POLL_MS)
    }
    const flush = () => {
      flushTimer = undefined
      if (pending.length === 0) return
      const batch = pending.splice(0)
      setEvents((existing) => [...existing, ...batch])
    }

    const startStream = () => {
      if (cancelled) return
      if (typeof EventSource === 'undefined') return startPolling()
      const query = cursor.current ? `?after=${cursor.current}` : ''
      source = new EventSource(codexUrl(`/api/admin/processing/${documentId}/stream${query}`))
      setTransport('stream')
      source.addEventListener('meta', (message) => {
        const meta = JSON.parse((message as MessageEvent<string>).data) as { runId: string; runs?: ProcessingRun[] }
        if (meta.runs) setRuns(meta.runs)
        if (runRef.current && meta.runId !== runRef.current) {
          // A new run started (reprocess): start the stream over.
          pending.length = 0
          setEvents([])
        }
        runRef.current = meta.runId
        setRunId(meta.runId)
      })
      source.addEventListener('processing', (message) => {
        const event = JSON.parse((message as MessageEvent<string>).data) as ProcessingEvent
        if (cursor.current && BigInt(event.id) <= BigInt(cursor.current)) return
        cursor.current = event.id
        pending.push(event)
        flushTimer ??= setTimeout(flush, STREAM_BATCH_MS)
      })
      source.onopen = () => setError(null)
      source.onerror = () => {
        // EventSource retries by itself; CLOSED means it gave up (auth, 404).
        if (source?.readyState === EventSource.CLOSED) {
          source.close()
          source = undefined
          startPolling()
        }
      }
    }

    void (async () => {
      await poll()
      if (active) startStream()
      else setTransport('idle')
    })()
    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
      source?.close()
      if (flushTimer) clearTimeout(flushTimer)
      flush()
    }
  }, [documentId, active, replayRunId, poll])

  // Replay: load a whole run.
  useEffect(() => {
    if (!documentId || !replayRunId) {
      setReplayEvents([])
      return
    }
    let cancelled = false
    ;(async () => {
      const all: ProcessingEvent[] = []
      let after: string | null = null
      for (;;) {
        const page = await fetchEvents(documentId, { after, runId: replayRunId })
        all.push(...page.events)
        after = page.nextAfter
        if (!page.hasMore) break
      }
      if (!cancelled) {
        setReplayEvents(all)
        setReplayIndex(0)
        setPlaying(true)
      }
    })().catch((err) => setError(err instanceof Error ? err.message : String(err)))
    return () => {
      cancelled = true
    }
  }, [documentId, replayRunId])

  useEffect(() => {
    if (!playing || !replayRunId) return
    if (replayIndex >= replayEvents.length) {
      setPlaying(false)
      return
    }
    const timer = setTimeout(() => setReplayIndex((index) => index + 1), 400)
    return () => clearTimeout(timer)
  }, [playing, replayIndex, replayEvents.length, replayRunId])

  const visible = replayRunId ? replayEvents.slice(0, replayIndex) : events

  return {
    events: visible,
    runs,
    runId: replayRunId ?? runId,
    error,
    transport: replayRunId ? ('idle' as const) : transport,
    refresh: poll,
    replay: {
      active: Boolean(replayRunId),
      total: replayEvents.length,
      index: replayIndex,
      playing,
      play: () => setPlaying(true),
      pause: () => setPlaying(false),
      step: () => setReplayIndex((index) => Math.min(replayEvents.length, index + 1)),
      restart: () => {
        setReplayIndex(0)
        setPlaying(true)
      },
    },
  }
}

/** Derived view state for the canvas: candidates by status, entities, quality. */
export function useLiveState(events: ProcessingEvent[]) {
  return useMemo(() => deriveLiveState(events), [events])
}

export function deriveLiveState(events: ProcessingEvent[]) {
  const candidates = new Map<string, CandidateState>()
  const entities: Array<ExtractedEntityPayload & { eventId: string }> = []
  const completedPages = new Set<number>()
  let quality: { average?: number; lowPages: number[] } = { lowPages: [] }
  let model: string | undefined
  let activeStage: string | undefined
  let pipelineVersion: string | undefined
  let telemetry: { message: string; gpu: GpuTelemetry; at: string } | undefined
  let rejected = 0
  let schemaFailures = 0

  for (const event of events) {
    const payload = event.payload || {}
    switch (event.kind) {
      case 'stage_started': {
        activeStage = event.stage
        if (typeof payload.pipelineVersion === 'string') pipelineVersion = payload.pipelineVersion
        if (event.stage === 'extract' && Array.isArray(payload.candidates)) {
          model = typeof payload.model === 'string' ? payload.model : model
          for (const candidate of payload.candidates as Array<Omit<CandidateState, 'status'>>) {
            candidates.set(candidate.key, { ...candidate, status: 'queued' })
          }
        }
        break
      }
      case 'page_layout': {
        if (event.pageNumber) completedPages.add(event.pageNumber)
        // Stat blocks spotted as the page is segmented, before extraction starts.
        if (Array.isArray(payload.candidates)) {
          for (const candidate of payload.candidates as Array<Omit<CandidateState, 'status'>>) {
            if (!candidates.has(candidate.key)) candidates.set(candidate.key, { ...candidate, status: 'detected' })
          }
        }
        break
      }
      case 'page_markdown':
        if (event.pageNumber) completedPages.add(event.pageNumber)
        break
      case 'crop_dispatched': {
        const key = typeof payload.candidateKey === 'string' ? payload.candidateKey : undefined
        const existing = key ? candidates.get(key) : undefined
        if (existing) existing.status = 'extracting'
        if (typeof payload.model === 'string') model = payload.model
        break
      }
      case 'entity_extracted': {
        const entity = payload as unknown as ExtractedEntityPayload
        entities.push({ ...entity, eventId: event.id })
        const existing = candidates.get(entity.source.candidateKey)
        if (existing && existing.status !== 'needs_review') {
          existing.status = entity.review.status === 'auto' ? 'extracted' : 'needs_review'
          existing.confidence = entity.review.confidence
        }
        break
      }
      case 'entity_rejected': {
        rejected += 1
        if (payload.parseFailed === true) schemaFailures += 1
        const key = (payload.source as { candidateKey?: string } | undefined)?.candidateKey
        const existing = key ? candidates.get(key) : undefined
        if (existing) existing.status = 'rejected'
        break
      }
      case 'quality':
        quality = {
          average: typeof payload.average === 'number' ? payload.average : undefined,
          lowPages: Array.isArray(payload.lowPages) ? (payload.lowPages as number[]) : [],
        }
        break
      case 'telemetry':
        telemetry = { message: event.message, gpu: payload as unknown as GpuTelemetry, at: event.createdAt }
        break
      case 'stage_completed':
      case 'stage_failed':
        if (activeStage === event.stage) activeStage = undefined
        break
    }
  }

  return {
    candidates: [...candidates.values()],
    entities,
    completedPages: [...completedPages].sort((a, b) => a - b),
    quality,
    model,
    activeStage,
    pipelineVersion,
    telemetry,
    rejected,
    schemaFailures,
    steps: derivePipelineSteps(events, pipelineVersion),
  }
}
