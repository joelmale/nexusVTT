import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { codexFetch } from '@/lib/api'
import type {
  CandidateState,
  EventsResponse,
  ExtractedEntityPayload,
  ProcessingEvent,
  ProcessingRun,
} from './types'

export const LIVE_POLL_MS = 1500
const PAGE_LIMIT = 200

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
 * Live mode: polls `?after=<last id>` every 1.5 s while `active`, and stops
 * otherwise (the plan's polling model; no websocket needed).
 * Replay mode: loads every event of `replayRunId`, then reveals them one at a
 * time on a timer that the caller controls (`replay.step`, `replay.play`).
 */
export function useProcessingEvents(documentId: string | null, options: { active: boolean; replayRunId?: string | null }) {
  const { active, replayRunId } = options
  const [events, setEvents] = useState<ProcessingEvent[]>([])
  const [runs, setRuns] = useState<ProcessingRun[]>([])
  const [runId, setRunId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
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

  // Initial load, then live polling while a job is active.
  useEffect(() => {
    if (!documentId || replayRunId) return
    void poll()
    if (!active) return
    const timer = setInterval(() => void poll(), LIVE_POLL_MS)
    return () => clearInterval(timer)
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

  for (const event of events) {
    const payload = event.payload || {}
    switch (event.kind) {
      case 'stage_started': {
        activeStage = event.stage
        if (typeof payload.pipelineVersion === 'string') pipelineVersion = payload.pipelineVersion
        if (event.stage === 'extract' && Array.isArray(payload.candidates)) {
          model = typeof payload.model === 'string' ? payload.model : model
          for (const candidate of payload.candidates as Array<Omit<CandidateState, 'status'>>) {
            candidates.set(candidate.key, { ...candidate, status: 'extracting' })
          }
        }
        break
      }
      case 'page_layout':
      case 'page_markdown':
        if (event.pageNumber) completedPages.add(event.pageNumber)
        break
      case 'entity_extracted': {
        const entity = payload as unknown as ExtractedEntityPayload
        entities.push({ ...entity, eventId: event.id })
        const existing = candidates.get(entity.source.candidateKey)
        if (existing && existing.status !== 'needs_review') {
          existing.status = entity.review.status === 'auto' ? 'extracted' : 'needs_review'
        }
        break
      }
      case 'entity_rejected': {
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
  }
}
