import type { ProcessingEvent } from './types'

// Action console labels (kept out of ActionFeed.tsx for fast refresh).

type Tag = { label: string; className: string }

const TAG = {
  pipeline: 'border-gray-300 bg-gray-50 text-gray-600',
  layout: 'border-sky-300 bg-sky-50 text-sky-700',
  marker: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  worker: 'border-amber-300 bg-amber-50 text-amber-800',
  vlm: 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700',
  index: 'border-teal-300 bg-teal-50 text-teal-700',
  gpu: 'border-lime-400 bg-lime-50 text-lime-800',
  quality: 'border-yellow-400 bg-yellow-50 text-yellow-800',
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
