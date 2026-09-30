import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ClipboardCheck, Pause, Play, RotateCcw, SkipForward } from 'lucide-react'
import { codexFetch, codexUrl } from '@/lib/api'
import { ActionFeed } from './ActionFeed'
import { GoldsetEditor } from './GoldsetEditor'
import type { GoldLabel } from './goldset'
import { EntityCard } from './EntityCard'
import { OverlayLegend, PageOverlay } from './PageOverlay'
import { PipelineStepper } from './PipelineStepper'
import { eventInStep } from './pipeline'
import { QualityBadge } from './QualityBadge'
import { useLiveState, useProcessingEvents } from './useProcessingEvents'
import { useReducedMotion } from './useReducedMotion'
import type { BBox, ExtractedEntityPayload, LayoutBlock, PageDetail, PageSummary, ProcessingEvent } from './types'

/** Batches arrive as bursts; the canvas steps through a burst this fast. */
export const PAGE_REVEAL_MS = 600

/** Ticks once a second while `enabled`, for live elapsed timers. */
function useNow(enabled: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [enabled])
  return now
}

/**
 * Follows the newest completed page, but walks through a burst of pages one
 * at a time so a five-page batch reads as a stream (instant with reduced motion).
 */
function useRevealedLatest(pages: number[], reducedMotion: boolean) {
  const latest = pages.length ? pages[pages.length - 1] : null
  const [shown, setShown] = useState<number | null>(latest)
  useEffect(() => {
    if (latest === null) return setShown(null)
    if (reducedMotion || shown === null || shown >= latest) return setShown(latest)
    const next = pages.find((page) => page > shown) ?? latest
    const timer = setTimeout(() => setShown(next), PAGE_REVEAL_MS)
    return () => clearTimeout(timer)
  }, [latest, shown, pages, reducedMotion])
  return shown
}

function PageMarkdown({ documentId, pageNumber, defaultOpen = false }: { documentId: string; pageNumber: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const { data } = useQuery<PageDetail>({
    queryKey: ['live-page', documentId, pageNumber],
    queryFn: async () => {
      const response = await codexFetch(`/api/admin/processing/${documentId}/pages/${pageNumber}`)
      if (!response.ok) throw new Error('Failed to load page')
      return response.json()
    },
    enabled: open,
  })
  return (
    <details
      open={open}
      className="rounded border border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20"
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer px-2 py-1 font-mono text-xs font-medium text-emerald-800 dark:text-emerald-300">Page {pageNumber} Markdown</summary>
      <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap px-2 pb-2 text-[11px] text-gray-800 dark:text-slate-200">{data ? data.markdown : 'Loading…'}</pre>
    </details>
  )
}

export interface LiveProofProps {
  documentId: string
  documentTitle?: string
  /** A job for this document is running: follow it live. */
  active: boolean
  rawLogs?: ReactNode
  /** Document.contentHash: identifies the source PDF in gold-set labels. */
  contentHash?: string | null
}

export function LiveProof({ documentId, documentTitle, active, rawLogs, contentHash }: LiveProofProps) {
  const reducedMotion = useReducedMotion()
  const [replayRunId, setReplayRunId] = useState<string | null>(null)
  const { events, runs, runId, error, replay, transport } = useProcessingEvents(documentId, { active, replayRunId })
  const live = useLiveState(events)
  const [selectedStep, setSelectedStep] = useState<string | null>(null)
  const running = live.steps.some((step) => step.status === 'active')
  const now = useNow(running && !replay.active)

  const [followLive, setFollowLive] = useState(true)
  const [manualPage, setManualPage] = useState<number | null>(null)
  const [highlight, setHighlight] = useState<BBox[]>([])
  const [selectedBlock, setSelectedBlock] = useState<LayoutBlock | null>(null)
  const [goldsetMode, setGoldsetMode] = useState(false)
  // Labels being edited, per page, so switching pages keeps unsaved work.
  const [goldLabels, setGoldLabels] = useState<Record<number, GoldLabel | null>>({})
  const [goldRegion, setGoldRegion] = useState<number | null>(null)
  const revealed = useRevealedLatest(live.completedPages, reducedMotion)

  const { data: pagesData } = useQuery<{ pages: PageSummary[] }>({
    queryKey: ['live-pages', documentId],
    queryFn: async () => {
      const response = await codexFetch(`/api/admin/processing/${documentId}/pages`)
      if (!response.ok) throw new Error('Failed to load pages')
      return response.json()
    },
    refetchInterval: active ? 5000 : false,
  })
  const pages = pagesData?.pages ?? []
  const pageNumber = (followLive ? revealed : manualPage) ?? revealed ?? pages[0]?.pageNumber ?? null

  const { data: page } = useQuery<PageDetail>({
    queryKey: ['live-page', documentId, pageNumber],
    queryFn: async () => {
      const response = await codexFetch(`/api/admin/processing/${documentId}/pages/${pageNumber}`)
      if (!response.ok) throw new Error('Failed to load page')
      return response.json()
    },
    enabled: pageNumber !== null,
  })

  useEffect(() => {
    setSelectedBlock(null)
    setGoldRegion(null)
  }, [pageNumber])

  const goldLabel = pageNumber !== null ? goldLabels[pageNumber] ?? null : null
  const setGoldLabel = (label: GoldLabel | null) => {
    if (pageNumber !== null) setGoldLabels((labels) => ({ ...labels, [pageNumber]: label }))
  }

  const selectPage = (value: number) => {
    setFollowLive(false)
    setManualPage(value)
    setHighlight([])
  }

  const showSource = (entity: ExtractedEntityPayload) => {
    const region = entity.source.regions.find((r) => r.pageNumber === entity.source.pageNumber) ?? entity.source.regions[0]
    selectPage(region?.pageNumber ?? entity.source.pageNumber)
    setHighlight(entity.source.regions.filter((r) => r.pageNumber === (region?.pageNumber ?? entity.source.pageNumber)).map((r) => r.bbox))
  }

  const newestEntityId = live.entities[live.entities.length - 1]?.eventId
  const activeStep = live.steps.find((step) => step.status === 'active')
  const failedStep = live.steps.find((step) => step.status === 'failed')
  const finished = events.length > 0 && live.steps.every((step) => step.status === 'done' || step.status === 'skipped')
  const stepLabel = selectedStep ? live.steps.find((step) => step.id === selectedStep)?.label : undefined

  // Clicking a step narrows the artifact stream and the console to it.
  const scoped = useMemo(
    () => (selectedStep ? events.filter((event) => eventInStep(event, selectedStep, live.pipelineVersion)) : events),
    [events, selectedStep, live.pipelineVersion]
  )
  // Artifact stream: page Markdown and entity cards in the order they happened.
  const stream = useMemo(
    () => scoped.filter((event): event is ProcessingEvent => event.kind === 'page_markdown' || event.kind === 'entity_extracted'),
    [scoped]
  )
  const newestMarkdownId = [...stream].reverse().find((event) => event.kind === 'page_markdown')?.id

  return (
    <section
      className="rounded-xl border border-gray-200 bg-white text-gray-900 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
      aria-labelledby="live-proof-title"
    >
      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
        <div className="min-w-0">
          <h2 id="live-proof-title" className="font-mono text-sm font-semibold tracking-wide text-gray-900 dark:text-slate-100">
            CODEX INGESTION ENGINE
            {documentTitle && <span className="font-normal text-gray-500 dark:text-slate-400"> :: {documentTitle}</span>}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <QualityBadge label="Lexicon Match" value={live.quality.average} lowPages={live.quality.lowPages} onSelectPage={selectPage} />
            <span
              className={`rounded-md border px-2 py-0.5 font-mono ${
                failedStep
                  ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300'
                  : 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300'
              }`}
              data-testid="stage-indicator"
            >
              {failedStep
                ? `FAILED: ${failedStep.label}`
                : activeStep
                  ? `ACTIVE: ${activeStep.label}`
                  : finished
                    ? 'COMPLETE'
                    : active
                      ? 'ACTIVE: waiting for worker'
                      : 'IDLE'}
            </span>
            {live.model && (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 font-mono text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                {live.activeStage === 'extract' && (
                  <span className="h-2 w-2 rounded-full bg-amber-500 motion-safe:animate-pulse" aria-hidden="true" />
                )}
                VLM: {live.model}
              </span>
            )}
            {transport !== 'idle' && (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-gray-500 dark:text-slate-400" data-testid="transport">
                <span className={`h-1.5 w-1.5 rounded-full ${transport === 'stream' ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden="true" />
                {transport === 'stream' ? 'live' : 'polling'}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            aria-pressed={goldsetMode}
            onClick={() => {
              setGoldsetMode((value) => !value)
              setFollowLive(false)
              setManualPage(pageNumber)
            }}
            className={`inline-flex items-center gap-1 rounded border px-2 py-1 ${goldsetMode ? 'border-yellow-500 bg-yellow-50 text-yellow-900' : 'border-gray-300 dark:border-slate-700'}`}
          >
            <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Gold-set edit
          </button>
          <label className="flex items-center gap-1">
            <span className="text-gray-500 dark:text-slate-400">Run</span>
            <select
              value={replayRunId ?? ''}
              onChange={(e) => setReplayRunId(e.target.value || null)}
              className="rounded border border-gray-300 bg-white px-1.5 py-1 dark:border-slate-700 dark:bg-slate-800"
              aria-label="Replay a run"
            >
              <option value="">Live{runId && !replayRunId ? ` (${runId.slice(0, 8)})` : ''}</option>
              {runs.map((run) => (
                <option key={run.runId} value={run.runId}>
                  Replay {run.startedAt ? new Date(run.startedAt).toLocaleString() : run.runId.slice(0, 8)} · {run.events} events
                </option>
              ))}
            </select>
          </label>
          {replay.active && (
            <div className="flex items-center gap-1" aria-label="Replay controls">
              <button type="button" onClick={replay.playing ? replay.pause : replay.play} className="rounded border border-gray-300 p-1 dark:border-slate-700" aria-label={replay.playing ? 'Pause replay' : 'Play replay'}>
                {replay.playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
              <button type="button" onClick={replay.step} className="rounded border border-gray-300 p-1 dark:border-slate-700" aria-label="Next event">
                <SkipForward className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={replay.restart} className="rounded border border-gray-300 p-1 dark:border-slate-700" aria-label="Restart replay">
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <span className="font-mono text-gray-500">
                {replay.index}/{replay.total}
              </span>
            </div>
          )}
        </div>
      </div>

      {error && <p className="px-4 pt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

      <div className="space-y-2 px-4 pt-4">
        {live.pipelineVersion === 'v1' && (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200" role="note">
            This run used pipeline v1 (page renders + RapidOCR, text-rule extraction). Layout boxes, Marker Markdown and VLM stat
            cards come from pipeline v2: set <code className="font-mono">PIPELINE_VERSION=v2</code> on doc-processor and reprocess.
          </p>
        )}
        {events.length === 0 && !error && (
          <p className="rounded-md border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-600 dark:border-slate-700 dark:text-slate-400" role="note">
            {active
              ? 'Waiting for the worker to report its first step…'
              : 'No processing events for this document. Events are recorded for runs since the live-processing release; reprocess it to watch it here.'}
          </p>
        )}
        <PipelineStepper steps={live.steps} now={now} selected={selectedStep} onSelect={setSelectedStep} />
      </div>

      {/* Split view: page left, artifacts right; stacked below 1024px (lg). */}
      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2" data-testid="live-proof-split">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-1">
              <span className="text-gray-500 dark:text-slate-400">Page</span>
              <select
                value={pageNumber ?? ''}
                onChange={(e) => selectPage(Number(e.target.value))}
                disabled={pages.length === 0}
                className="rounded border border-gray-300 bg-white px-1.5 py-1 dark:border-slate-700 dark:bg-slate-800"
                aria-label="Page"
              >
                {pages.map((p) => (
                  <option key={p.pageNumber} value={p.pageNumber}>
                    {p.pageNumber}
                    {typeof p.quality?.wordValidity === 'number' ? ` · ${(p.quality.wordValidity * 100).toFixed(0)}%` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={followLive}
                onChange={(e) => {
                  setFollowLive(e.target.checked)
                  if (e.target.checked) setHighlight([])
                }}
              />
              Follow live
            </label>
            {page && <QualityBadge value={page.quality?.wordValidity} label={`p.${page.pageNumber}`} />}
          </div>

          {pageNumber !== null && page ? (
            <PageOverlay
              pageNumber={page.pageNumber}
              previewUrl={page.hasPreview ? codexUrl(`/api/admin/processing/${documentId}/pages/${page.pageNumber}/preview`) : null}
              widthPt={page.widthPt}
              heightPt={page.heightPt}
              blocks={page.blocks}
              candidates={goldsetMode ? [] : live.candidates}
              highlight={highlight}
              selectedBlockId={selectedBlock?.id}
              onSelectBlock={goldsetMode ? undefined : setSelectedBlock}
              goldRegions={goldsetMode ? goldLabel?.regions : undefined}
              selectedGoldRegion={goldRegion}
              onSelectGoldRegion={setGoldRegion}
              onDrawBox={
                goldsetMode && goldLabel
                  ? (bbox) => {
                      setGoldLabel({ ...goldLabel, regions: [...goldLabel.regions, { class: 'stat_block', bbox }] })
                      setGoldRegion(goldLabel.regions.length)
                    }
                  : undefined
              }
            />
          ) : (
            <div className="flex aspect-[612/792] items-center justify-center rounded-md border border-dashed border-gray-300 text-xs text-gray-400 dark:border-slate-700 dark:text-slate-500">
              No layout pages yet
            </div>
          )}
          <OverlayLegend />
        </div>

        {goldsetMode && page ? (
          <div className="min-w-0 space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Gold-set label · page {page.pageNumber}</h3>
            <GoldsetEditor
              documentId={documentId}
              documentTitle={documentTitle}
              contentHash={contentHash}
              page={page}
              label={goldLabel}
              onChange={setGoldLabel}
              selectedRegion={goldRegion}
              onSelectRegion={setGoldRegion}
            />
          </div>
        ) : (
        <div className="flex min-w-0 flex-col gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            Artifact stream
            {stepLabel && <span className="ml-2 font-mono text-xs font-normal text-indigo-600 dark:text-indigo-300">{stepLabel}</span>}
          </h3>
          {selectedBlock && (
            <div className="rounded border border-emerald-300 bg-emerald-50 p-2 text-xs" data-testid="selected-block">
              <div className="mb-1 font-mono text-[10px] uppercase text-emerald-700">
                {selectedBlock.id} · {selectedBlock.class} ({selectedBlock.markerType})
              </div>
              <pre className="whitespace-pre-wrap text-gray-800">{selectedBlock.markdown ?? 'Excluded from text'}</pre>
            </div>
          )}
          <div className="max-h-[36rem] space-y-2 overflow-y-auto pr-1">
            {stream.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-slate-500">
                {stepLabel ? `No artifacts from ${stepLabel}.` : 'Page Markdown and extracted entities appear here as they are produced.'}
              </p>
            )}
            {stream.map((event) =>
              event.kind === 'page_markdown' && event.pageNumber ? (
                <PageMarkdown key={event.id} documentId={documentId} pageNumber={event.pageNumber} defaultOpen={event.id === newestMarkdownId} />
              ) : (
                <EntityCard
                  key={event.id}
                  entity={event.payload as unknown as ExtractedEntityPayload}
                  isNew={event.id === newestEntityId}
                  reducedMotion={reducedMotion}
                  onShowSource={showSource}
                />
              )
            )}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-2 font-mono text-[11px] dark:border-slate-800" data-testid="artifact-footer">
            <span
              className={`rounded border px-1.5 py-0.5 ${
                live.schemaFailures > 0
                  ? 'border-red-300 text-red-700 dark:border-red-800 dark:text-red-300'
                  : 'border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300'
              }`}
            >
              [JSON Schema: {live.schemaFailures > 0 ? `${live.schemaFailures} invalid` : 'Valid'}]
            </span>
            <span className="rounded border border-purple-300 px-1.5 py-0.5 text-purple-700 dark:border-purple-800 dark:text-purple-300">
              [Parsed: {live.entities.length} {live.entities.length === 1 ? 'Entity' : 'Entities'}]
            </span>
            {live.rejected > 0 && (
              <span className="rounded border border-gray-300 px-1.5 py-0.5 text-gray-600 dark:border-slate-700 dark:text-slate-400">
                [No entity: {live.rejected}]
              </span>
            )}
          </div>
        </div>
        )}
      </div>

      <div className="px-4 pb-4">
        <ActionFeed
          events={scoped}
          rawLogs={rawLogs}
          filterLabel={stepLabel}
          onClearFilter={() => setSelectedStep(null)}
          statusLine={live.telemetry ? <span data-testid="gpu-telemetry">{live.telemetry.message}</span> : undefined}
        />
      </div>
    </section>
  )
}

export default LiveProof
