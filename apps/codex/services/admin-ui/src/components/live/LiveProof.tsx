import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react'
import { codexFetch, codexUrl } from '@/lib/api'
import { ActionFeed } from './ActionFeed'
import { EntityCard } from './EntityCard'
import { OverlayLegend, PageOverlay } from './PageOverlay'
import { QualityBadge } from './QualityBadge'
import { useLiveState, useProcessingEvents } from './useProcessingEvents'
import { useReducedMotion } from './useReducedMotion'
import type { BBox, ExtractedEntityPayload, LayoutBlock, PageDetail, PageSummary, ProcessingEvent } from './types'

const V2_STAGES = ['ingest', 'layout', 'extract', 'index', 'assets']
const V1_STAGES = ['ingest', 'render', 'ocr', 'extract', 'index', 'assets']
const STAGE_NAMES: Record<string, string> = {
  ingest: 'Ingest', render: 'Render', ocr: 'OCR', layout: 'Layout', extract: 'Extraction', index: 'Index', assets: 'Assets',
}
/** Batches arrive as bursts; the canvas steps through a burst this fast. */
export const PAGE_REVEAL_MS = 600

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

function PageMarkdown({ documentId, pageNumber }: { documentId: string; pageNumber: number }) {
  const [open, setOpen] = useState(false)
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
    <details className="rounded border border-gray-200 bg-gray-50" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer px-2 py-1 text-xs font-medium text-gray-700">Page {pageNumber} Markdown</summary>
      <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap px-2 pb-2 text-[11px] text-gray-800">{data ? data.markdown : 'Loading…'}</pre>
    </details>
  )
}

export interface LiveProofProps {
  documentId: string
  documentTitle?: string
  /** A job for this document is running: poll every 1.5 s. */
  active: boolean
  rawLogs?: ReactNode
}

export function LiveProof({ documentId, documentTitle, active, rawLogs }: LiveProofProps) {
  const reducedMotion = useReducedMotion()
  const [replayRunId, setReplayRunId] = useState<string | null>(null)
  const { events, runs, runId, error, replay } = useProcessingEvents(documentId, { active, replayRunId })
  const live = useLiveState(events)

  const [followLive, setFollowLive] = useState(true)
  const [manualPage, setManualPage] = useState<number | null>(null)
  const [highlight, setHighlight] = useState<BBox[]>([])
  const [selectedBlock, setSelectedBlock] = useState<LayoutBlock | null>(null)
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
  }, [pageNumber])

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

  const stages = live.pipelineVersion === 'v1' ? V1_STAGES : V2_STAGES
  const stageIndex = live.activeStage ? stages.indexOf(live.activeStage) : -1
  const newestEntityId = live.entities[live.entities.length - 1]?.eventId

  // Artifact stream: page Markdown and entity cards in the order they happened.
  const stream = useMemo(
    () => events.filter((event): event is ProcessingEvent => event.kind === 'page_markdown' || event.kind === 'entity_extracted'),
    [events]
  )

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm" aria-labelledby="live-proof-title">
      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50/80 px-4 py-3">
        <div className="min-w-0">
          <h2 id="live-proof-title" className="text-sm font-semibold text-gray-900">
            Live Proof
            {documentTitle && <span className="ml-2 font-normal text-gray-500">{documentTitle}</span>}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <QualityBadge value={live.quality.average} lowPages={live.quality.lowPages} onSelectPage={selectPage} />
            <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-mono text-indigo-700" data-testid="stage-indicator">
              {live.activeStage && stageIndex >= 0
                ? `Stage: ${STAGE_NAMES[live.activeStage] ?? live.activeStage} (${stageIndex + 1} of ${stages.length})`
                : active
                  ? 'Stage: waiting'
                  : 'Idle'}
            </span>
            {live.model && (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 font-mono text-amber-800">
                {live.activeStage === 'extract' && (
                  <span className="h-2 w-2 rounded-full bg-amber-500 motion-safe:animate-pulse" aria-hidden="true" />
                )}
                VLM: {live.model}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1">
            <span className="text-gray-500">Run</span>
            <select
              value={replayRunId ?? ''}
              onChange={(e) => setReplayRunId(e.target.value || null)}
              className="rounded border border-gray-300 px-1.5 py-1"
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
              <button type="button" onClick={replay.playing ? replay.pause : replay.play} className="rounded border border-gray-300 p-1" aria-label={replay.playing ? 'Pause replay' : 'Play replay'}>
                {replay.playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
              <button type="button" onClick={replay.step} className="rounded border border-gray-300 p-1" aria-label="Next event">
                <SkipForward className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={replay.restart} className="rounded border border-gray-300 p-1" aria-label="Restart replay">
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <span className="font-mono text-gray-500">
                {replay.index}/{replay.total}
              </span>
            </div>
          )}
        </div>
      </div>

      {error && <p className="px-4 pt-2 text-xs text-red-600">{error}</p>}

      {/* Split view: page left, artifacts right; stacked below 1024px (lg). */}
      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2" data-testid="live-proof-split">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-1">
              <span className="text-gray-500">Page</span>
              <select
                value={pageNumber ?? ''}
                onChange={(e) => selectPage(Number(e.target.value))}
                disabled={pages.length === 0}
                className="rounded border border-gray-300 px-1.5 py-1"
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
              candidates={live.candidates}
              highlight={highlight}
              selectedBlockId={selectedBlock?.id}
              onSelectBlock={setSelectedBlock}
            />
          ) : (
            <div className="flex aspect-[612/792] items-center justify-center rounded-md border border-dashed border-gray-300 text-xs text-gray-400">
              No layout pages yet
            </div>
          )}
          <OverlayLegend />
        </div>

        <div className="min-w-0 space-y-2">
          <h3 className="text-sm font-semibold text-gray-900">Artifact stream</h3>
          {selectedBlock && (
            <div className="rounded border border-emerald-300 bg-emerald-50 p-2 text-xs" data-testid="selected-block">
              <div className="mb-1 font-mono text-[10px] uppercase text-emerald-700">
                {selectedBlock.id} · {selectedBlock.class} ({selectedBlock.markerType})
              </div>
              <pre className="whitespace-pre-wrap text-gray-800">{selectedBlock.markdown ?? 'Excluded from text'}</pre>
            </div>
          )}
          <div className="max-h-[36rem] space-y-2 overflow-y-auto pr-1">
            {stream.length === 0 && <p className="text-xs text-gray-400">Page Markdown and extracted entities appear here as they are produced.</p>}
            {stream.map((event) =>
              event.kind === 'page_markdown' && event.pageNumber ? (
                <PageMarkdown key={event.id} documentId={documentId} pageNumber={event.pageNumber} />
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
        </div>
      </div>

      <div className="px-4 pb-4">
        <ActionFeed events={events} rawLogs={rawLogs} />
      </div>
    </section>
  )
}

export default LiveProof
