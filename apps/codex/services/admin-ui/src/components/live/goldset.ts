import type { BBox, EntityType, PageDetail } from './types'

/**
 * Gold-set page labels (apps/codex/eval/goldset/label.schema.json). The editor
 * drafts a label from the pipeline's output for the page; a person then
 * corrects every field and downloads the JSON into apps/codex/eval/goldset/pages/.
 */

export const GOLD_REGION_CLASSES = ['stat_block', 'sidebar', 'table', 'art'] as const
export type GoldRegionClass = (typeof GOLD_REGION_CLASSES)[number]

export const GOLD_CATEGORIES = [
  'two_column_prose',
  'two_column_sidebar',
  'monster_stat_block',
  'spells',
  'magic_items',
  'tables',
  'scanned',
  'heavy_art',
] as const

export interface GoldRegion {
  class: GoldRegionClass
  bbox: BBox
  note?: string
}

export interface GoldEntity {
  type: EntityType
  data: Record<string, unknown> & { name: string }
  numbersChecked?: boolean
}

export interface GoldLabel {
  $schema?: string
  id: string
  goldsetVersion: number
  source: { sha256: string; pageNumber: number; title?: string; synthetic?: boolean }
  category: (typeof GOLD_CATEGORIES)[number]
  heldOut: boolean
  status: 'draft' | 'verified'
  review: { verifiedBy: string | null; verifiedAt: string | null; numbersChecked: boolean; notes?: string }
  text: string
  regions: GoldRegion[]
  entities: GoldEntity[]
}

/** A StructuredData row as doc-api returns it (GET documents/:id/structured-data). */
export interface StructuredDataRow {
  type: string
  name: string
  pageNumber: number | null
  data: Record<string, unknown>
}

const PIPELINE_ONLY_FIELDS = ['review', 'source', 'confidence', 'needsReview', 'rawSnippet', 'failureReason']

const round4 = (value: number) => Math.round(value * 10000) / 10000

export const clampBBox = (bbox: number[]): BBox => {
  const [x0, y0, x1, y1] = bbox.map((v) => round4(Math.min(1, Math.max(0, Number(v) || 0))))
  return [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)]
}

/** Paragraph text in reading order from the pipeline's blocks (art and furniture carry no text). */
export const readingOrderText = (page: PageDetail) =>
  page.blocks
    .filter((block) => block.markdown && block.class !== 'art' && block.class !== 'furniture')
    .map((block) => block.markdown!.trim())
    .join('\n\n') || page.markdown

const pageRows = (rows: StructuredDataRow[], pageNumber: number) =>
  rows.filter((row) => {
    const regions = ((row.data?.source as { regions?: Array<{ pageNumber: number }> } | undefined)?.regions) ?? []
    return row.pageNumber === pageNumber || regions.some((region) => region.pageNumber === pageNumber)
  })

/**
 * Draft by machine: text, region boxes and entities from the pipeline's output.
 * The draft is status "draft" with numbersChecked false: nothing counts as an
 * answer until a person has verified it.
 */
export function buildDraftLabel(params: {
  page: PageDetail
  contentHash: string
  rows: StructuredDataRow[]
  goldsetVersion?: number
  documentTitle?: string
}): GoldLabel {
  const { page, contentHash, rows, goldsetVersion = 1, documentTitle } = params
  const onPage = pageRows(rows, page.pageNumber)

  const regions: GoldRegion[] = [
    ...page.blocks
      .filter((block) => block.class === 'sidebar' || block.class === 'table' || block.class === 'art')
      .map((block) => ({ class: block.class as GoldRegionClass, bbox: clampBBox(block.bbox) })),
    ...onPage.flatMap((row) =>
      (((row.data?.source as { regions?: Array<{ pageNumber: number; bbox: BBox }> } | undefined)?.regions) ?? [])
        .filter((region) => region.pageNumber === page.pageNumber)
        .map((region) => ({ class: 'stat_block' as const, bbox: clampBBox(region.bbox) }))
    ),
  ]

  const entities: GoldEntity[] = onPage
    .filter((row) => row.type === 'monster' || row.type === 'spell' || row.type === 'item')
    .filter((row) => (row.data?.review as { reasons?: string[] } | undefined)?.reasons?.includes('schema_invalid') !== true)
    .map((row) => {
      const data = Object.fromEntries(Object.entries(row.data || {}).filter(([key]) => !PIPELINE_ONLY_FIELDS.includes(key)))
      return { type: row.type as EntityType, data: { ...data, name: row.name }, numbersChecked: false }
    })

  return {
    $schema: '../label.schema.json',
    id: `${contentHash.slice(0, 8)}-p${page.pageNumber}`,
    goldsetVersion,
    source: { sha256: contentHash, pageNumber: page.pageNumber, ...(documentTitle ? { title: documentTitle } : {}) },
    category: entities.some((e) => e.type === 'monster')
      ? 'monster_stat_block'
      : entities.some((e) => e.type === 'spell')
        ? 'spells'
        : entities.some((e) => e.type === 'item')
          ? 'magic_items'
          : regions.some((r) => r.class === 'sidebar')
            ? 'two_column_sidebar'
            : 'two_column_prose',
    heldOut: false,
    status: 'draft',
    review: { verifiedBy: null, verifiedAt: null, numbersChecked: false, notes: '' },
    text: readingOrderText(page),
    regions,
    entities,
  }
}

/** Problems that block marking a page verified or downloading it. Mirrors label.schema.json. */
export function validateLabel(label: GoldLabel): string[] {
  const problems: string[] = []
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(label.id)) problems.push('id must be 3-64 lower-case letters, digits or hyphens')
  if (!label.source.sha256) problems.push('source.sha256 is required')
  if (!(label.source.pageNumber >= 1)) problems.push('source.pageNumber must be at least 1')
  if (!GOLD_CATEGORIES.includes(label.category)) problems.push('category is not a known category')
  if (!label.text.trim()) problems.push('text is empty')
  label.regions.forEach((region, index) => {
    if (!GOLD_REGION_CLASSES.includes(region.class)) problems.push(`region ${index + 1}: unknown class`)
    if (region.bbox.length !== 4 || region.bbox.some((v) => v < 0 || v > 1)) problems.push(`region ${index + 1}: bbox must be 4 numbers in 0..1`)
    if (region.bbox[2] <= region.bbox[0] || region.bbox[3] <= region.bbox[1]) problems.push(`region ${index + 1}: bbox has no area`)
  })
  label.entities.forEach((entity, index) => {
    if (!entity.data?.name) problems.push(`entity ${index + 1}: name is required`)
  })
  if (label.status === 'verified') {
    if (!label.review.numbersChecked) problems.push('verified pages need the second pass on numbers (numbersChecked)')
    const unchecked = label.entities.filter((e) => !e.numbersChecked).map((e) => e.data.name)
    if (unchecked.length) problems.push(`numbers not checked for: ${unchecked.join(', ')}`)
    if (!label.review.verifiedBy) problems.push('verifiedBy is required for verified pages')
  }
  return problems
}

/** Parses an uploaded label file; throws with a readable message. */
export function parseLabel(json: string): GoldLabel {
  const value = JSON.parse(json) as GoldLabel
  if (!value || typeof value !== 'object' || !Array.isArray(value.regions) || !Array.isArray(value.entities) || !value.source) {
    throw new Error('Not a gold-set label (expected id, source, regions and entities)')
  }
  return value
}

export const serializeLabel = (label: GoldLabel) => `${JSON.stringify(label, null, 2)}\n`
