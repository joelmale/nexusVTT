import type { ProcessingEvent } from './types'

// Action console labels (kept out of ActionFeed.tsx for fast refresh).

type Tag = { label: string; className: string }

const TAG = {
  pipeline: 'border-slate-500 text-slate-300',
  layout: 'border-sky-500/60 text-sky-300',
  marker: 'border-emerald-500/60 text-emerald-300',
  worker: 'border-amber-500/60 text-amber-300',
  vlm: 'border-fuchsia-500/60 text-fuchsia-300',
  index: 'border-teal-500/60 text-teal-300',
  gpu: 'border-lime-500/60 text-lime-300',
  quality: 'border-yellow-500/60 text-yellow-300',
}

const STAGE_TAGS: Record<string, Tag> = {
  ingest: { label: 'INGEST', className: TAG.pipeline },
  render: { label: 'RENDER', className: TAG.pipeline },
  ocr: { label: 'RapidOCR', className: TAG.layout },
  layout: { label: 'LAYOUT', className: TAG.layout },
  extract: { label: 'EXTRACT', className: TAG.vlm },
  index: { label: 'INDEX', className: TAG.index },
  assets: { label: 'ASSETS', className: TAG.pipeline },
}

/** Who did the work: the engine for work events, the stage for lifecycle events. */
export function sourceTag(event: ProcessingEvent): Tag {
  switch (event.kind) {
    case 'page_layout':
      return { label: 'Surya Layout', className: TAG.layout }
    case 'page_markdown':
      return { label: 'Marker', className: TAG.marker }
    case 'crop_dispatched':
      return { label: 'Worker', className: TAG.worker }
    case 'entity_extracted':
    case 'entity_rejected':
      return { label: 'VLM', className: TAG.vlm }
    case 'telemetry':
      return { label: 'GPU', className: TAG.gpu }
    case 'quality':
      return { label: 'Lexicon', className: TAG.quality }
    case 'step_started':
    case 'step_completed':
      return event.payload?.step === 'chunking' ? { label: 'Chunker', className: TAG.index } : { label: 'Index', className: TAG.index }
    default:
      return STAGE_TAGS[event.stage] ?? { label: event.stage.toUpperCase(), className: TAG.pipeline }
  }
}

export const KIND_MARK: Partial<Record<ProcessingEvent['kind'], string>> = {
  stage_failed: 'FAILED',
  entity_rejected: 'REJECTED',
}
