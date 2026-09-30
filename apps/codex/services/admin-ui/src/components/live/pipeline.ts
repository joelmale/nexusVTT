import type { ProcessingEvent } from './types'

// Pipeline stepper model: which step each processing event belongs to, and
// each step's status, timing and progress. Pure, so it can be derived from a
// replayed run as easily as from the live stream.

export type StepStatus = 'pending' | 'active' | 'done' | 'failed' | 'skipped'

export interface PipelineStep {
  id: string
  label: string
  /** Engine or service doing the work, shown under the label. */
  engine: string
  status: StepStatus
  startedAt?: number
  endedAt?: number
  /** Progress text, e.g. "Page 14/48 · 2.3 s/page". */
  detail?: string
  /** 0..1 when the step can tell. */
  progress?: number
}

interface StepDef {
  id: string
  label: string
  engine: string
  /** Does this event belong to the step? */
  owns: (event: ProcessingEvent) => boolean
}

const stepOf = (event: ProcessingEvent) => (typeof event.payload?.step === 'string' ? event.payload.step : undefined)

export const V2_STEPS: StepDef[] = [
  { id: 'preflight', label: 'Pre-flight & Raster', engine: 'pdfjs · sha256', owns: (e) => e.stage === 'ingest' },
  { id: 'layout', label: 'Layout & OCR', engine: 'Surya · Marker', owns: (e) => e.stage === 'layout' },
  { id: 'vlm', label: 'VLM Entity Parsing', engine: 'Ollama', owns: (e) => e.stage === 'extract' },
  { id: 'chunking', label: 'Semantic Chunking', engine: 'page-aware · embeddings', owns: (e) => e.stage === 'index' && stepOf(e) === 'chunking' },
  {
    id: 'indexing',
    label: 'Vector & Elastic Index',
    engine: 'pgvector · Elasticsearch',
    owns: (e) => (e.stage === 'index' && stepOf(e) !== 'chunking') || e.stage === 'assets',
  },
]

export const V1_STEPS: StepDef[] = [
  { id: 'ingest', label: 'Ingest', engine: 'pdfjs', owns: (e) => e.stage === 'ingest' },
  { id: 'render', label: 'Render pages', engine: 'pdfjs', owns: (e) => e.stage === 'render' },
  { id: 'ocr', label: 'OCR', engine: 'RapidOCR', owns: (e) => e.stage === 'ocr' },
  { id: 'extract', label: 'Extraction', engine: 'text rules', owns: (e) => e.stage === 'extract' },
  { id: 'index', label: 'Index', engine: 'Elasticsearch', owns: (e) => e.stage === 'index' || e.stage === 'assets' },
]

export const stepsFor = (version: string | undefined) => (version === 'v1' ? V1_STEPS : V2_STEPS)

export function eventInStep(event: ProcessingEvent, stepId: string, version: string | undefined): boolean {
  const def = stepsFor(version).find((step) => step.id === stepId)
  return def ? def.owns(event) : true
}

const ms = (iso: string) => new Date(iso).getTime()
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)

export function formatDuration(totalMs: number): string {
  const seconds = Math.max(0, Math.round(totalMs / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

/**
 * One pass over a run's events. Sub-steps inside the index stage come from
 * step_started / step_completed; everything else from stage events.
 */
export function derivePipelineSteps(events: ProcessingEvent[], version: string | undefined): PipelineStep[] {
  const defs = stepsFor(version)
  const steps = new Map<string, PipelineStep>(defs.map((d) => [d.id, { id: d.id, label: d.label, engine: d.engine, status: 'pending' }]))
  const find = (event: ProcessingEvent) => defs.find((d) => d.owns(event))

  let layoutPages = 0
  let layoutTotal: number | undefined
  let secondsPerPage: number | undefined
  let candidates = 0
  let settled = 0
  let chunkCount: number | undefined

  for (const event of events) {
    const def = find(event)
    if (!def) continue
    const step = steps.get(def.id)!
    const at = ms(event.createdAt)
    const subStep = stepOf(event)

    switch (event.kind) {
      case 'stage_started':
        // The index stage starts its sub-steps explicitly on v2.
        if (version !== 'v1' && event.stage === 'index') break
        // Assets run after indexing; they never reopen the last step.
        if (event.stage === 'assets') break
        step.status = 'active'
        step.startedAt ??= at
        if (event.stage === 'extract' && Array.isArray(event.payload?.candidates)) candidates = event.payload.candidates.length
        break
      case 'step_started':
        step.status = 'active'
        step.startedAt ??= at
        break
      case 'step_completed':
        step.status = 'done'
        step.endedAt = at
        if (subStep === 'chunking') chunkCount = num(event.payload?.count)
        break
      case 'stage_completed':
        if (version !== 'v1' && event.stage === 'index') {
          // Close whatever sub-step is still open; a missing chunking step
          // (no layout pages, legacy chunks) is shown as skipped.
          for (const id of ['chunking', 'indexing']) {
            const sub = steps.get(id)!
            if (sub.status === 'active') {
              sub.status = 'done'
              sub.endedAt = at
            } else if (sub.status === 'pending') sub.status = id === 'chunking' ? 'skipped' : 'done'
          }
          break
        }
        if (event.stage === 'assets') break
        step.status = 'done'
        step.endedAt = at
        break
      case 'stage_failed': {
        const target = version !== 'v1' && event.stage === 'index' ? (steps.get('chunking')!.status === 'active' ? steps.get('chunking')! : steps.get('indexing')!) : step
        target.status = 'failed'
        target.endedAt = at
        target.startedAt ??= at
        break
      }
      case 'page_layout':
        layoutPages += 1
        layoutTotal = num(event.payload?.totalPages) ?? layoutTotal
        secondsPerPage = num(event.payload?.secondsPerPage) ?? secondsPerPage
        if (step.status === 'pending') {
          step.status = 'active'
          step.startedAt = at
        }
        break
      case 'entity_extracted':
      case 'entity_rejected':
        settled += 1
        break
    }
  }

  const layout = steps.get(version === 'v1' ? 'ocr' : 'layout')
  if (layout && version !== 'v1' && layoutPages > 0) {
    const pace = secondsPerPage !== undefined ? ` · ${secondsPerPage.toFixed(1)} s/page` : ''
    layout.detail = layoutTotal ? `Page ${Math.min(layoutPages, layoutTotal)}/${layoutTotal}${pace}` : `${layoutPages} pages${pace}`
    if (layoutTotal) layout.progress = Math.min(1, layoutPages / layoutTotal)
  }
  const vlm = steps.get(version === 'v1' ? 'extract' : 'vlm')
  if (vlm && version !== 'v1' && candidates > 0) {
    vlm.detail = `${Math.min(settled, candidates)}/${candidates} candidates`
    vlm.progress = Math.min(1, settled / candidates)
  } else if (vlm && version !== 'v1' && vlm.status === 'done') {
    vlm.detail = 'No stat blocks detected'
  }
  const chunking = steps.get('chunking')
  if (chunking && chunkCount !== undefined) chunking.detail = `${chunkCount} chunks`

  return [...steps.values()]
}
