// Shapes served by doc-api's live processing routes
// (apps/codex/services/doc-api/src/routes/admin/processing-events.ts) and
// emitted by doc-processor (src/services/processing-events.service.ts).

export type LayoutBlockClass = 'body' | 'heading' | 'table' | 'stat_block' | 'sidebar' | 'art' | 'furniture'

export type BBox = [number, number, number, number] // normalized 0..1 (x0, y0, x1, y1)

export interface LayoutBlock {
  id: string
  class: LayoutBlockClass
  markerType: string
  bbox: BBox
  markdown?: string
}

export interface PageQuality {
  wordValidity?: number
  symbolNoise?: number
  repetition?: number
  wordCount?: number
  textSource?: { embedded: number; ocr: number }
}

export interface PageSummary {
  pageNumber: number
  widthPt: number | null
  heightPt: number | null
  hasPreview: boolean
  quality: PageQuality
  engine: string
}

export interface PageDetail extends PageSummary {
  markdown: string
  blocks: LayoutBlock[]
}

export type ProcessingEventKind =
  | 'stage_started'
  | 'page_layout'
  | 'page_markdown'
  | 'entity_extracted'
  | 'entity_rejected'
  | 'quality'
  | 'stage_completed'
  | 'stage_failed'

export interface ProcessingEvent {
  id: string
  runId: string
  stage: string
  pageNumber: number | null
  kind: ProcessingEventKind
  message: string
  payload: Record<string, unknown>
  createdAt: string
}

export interface ProcessingRun {
  runId: string
  firstEventId: string | null
  lastEventId: string | null
  startedAt: string | null
  lastEventAt: string | null
  events: number
}

export interface EventsResponse {
  documentId: string
  runId: string | null
  events: ProcessingEvent[]
  nextAfter: string | null
  hasMore: boolean
  runs?: ProcessingRun[]
}

export interface CandidateRegion {
  pageNumber: number
  blockIds: string[]
  bbox: BBox
}

export type EntityType = 'monster' | 'spell' | 'item'

export interface EntityReview {
  status: 'auto' | 'needs_review'
  confidence: number
  reasons: string[]
  baseline?: string
}

export interface EntitySource {
  pageNumber: number
  blockIds: string[]
  regions: CandidateRegion[]
  candidateKey: string
}

/** entity_extracted payload: enough for a stat card; the full entity is in StructuredData. */
export interface ExtractedEntityPayload {
  type: EntityType
  name: string
  summary: Record<string, unknown>
  review: EntityReview
  source: EntitySource
  cached?: boolean
}

export type CandidateStatus = 'extracting' | 'extracted' | 'needs_review' | 'rejected'

export interface CandidateState {
  key: string
  type: EntityType
  title: string
  pageNumber: number
  regions: CandidateRegion[]
  status: CandidateStatus
}
