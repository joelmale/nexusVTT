import type { LayoutBlock, PageDetail, ProcessingEvent } from './types'

// Shared test data for the live processing components (SRD 5.1 content).

export const DOC = 'doc-1'
export const API = `/control-api/v1/codex/admin/processing/${DOC}`

export const BLOCKS: LayoutBlock[] = [
  { id: 'p12-b0', class: 'furniture', markerType: 'PageHeader', bbox: [0.05, 0.01, 0.95, 0.03] },
  { id: 'p12-b1', class: 'heading', markerType: 'SectionHeader', bbox: [0.06, 0.06, 0.45, 0.09], markdown: '## Gorgons' },
  { id: 'p12-b2', class: 'body', markerType: 'Text', bbox: [0.06, 0.1, 0.45, 0.6], markdown: 'Covered in plates of iron…' },
  { id: 'p12-b3', class: 'art', markerType: 'Picture', bbox: [0.06, 0.62, 0.45, 0.95] },
  { id: 'p12-b4', class: 'body', markerType: 'Text', bbox: [0.52, 0.1, 0.94, 0.5], markdown: '**Armor Class** 19' },
  { id: 'p12-b5', class: 'sidebar', markerType: 'Text', bbox: [0.52, 0.6, 0.94, 0.8], markdown: 'Variant: Gorgon Herds' },
]

export const PAGE_12: PageDetail = {
  pageNumber: 12,
  widthPt: 612,
  heightPt: 792,
  hasPreview: true,
  quality: { wordValidity: 0.964, wordCount: 412 },
  engine: 'marker@1.10.2',
  markdown: '## Gorgons\n\nCovered in plates of iron…',
  blocks: BLOCKS,
}

let id = 0
export const event = (overrides: Partial<ProcessingEvent>): ProcessingEvent => ({
  id: String(++id),
  runId: 'run-2',
  stage: 'layout',
  pageNumber: null,
  kind: 'stage_started',
  message: 'Layout started',
  payload: {},
  createdAt: '2026-09-28T14:02:11.000Z',
  ...overrides,
})

export const gorgonEvent = (overrides: Partial<ProcessingEvent> = {}) =>
  event({
    stage: 'extract',
    kind: 'entity_extracted',
    pageNumber: 12,
    message: 'qwen2.5vl:7b: extracted Gorgon (AC 19, HP 114, CR 5), all values grounded',
    payload: {
      type: 'monster',
      name: 'Gorgon',
      summary: {
        armorClass: 19,
        hitPoints: 114,
        hitDice: '12d10 + 48',
        challengeRating: '5 (1,800 XP)',
        sizeType: 'Large monstrosity, unaligned',
        speed: '40 ft.',
        abilities: { str: 20, dex: 11, con: 18, int: 2, wis: 12, cha: 7 },
        traits: ['Trample'],
        actions: ['Gore', 'Hooves', 'Petrifying Breath'],
      },
      review: { status: 'auto', confidence: 0.95, reasons: [], baseline: 'agrees' },
      source: {
        pageNumber: 12,
        blockIds: ['p12-b4'],
        regions: [{ pageNumber: 12, blockIds: ['p12-b4'], bbox: [0.52, 0.06, 0.94, 0.5] }],
        candidateKey: 'monster:p12:p12-b4',
      },
    },
    ...overrides,
  })

export const liveRunEvents = (): ProcessingEvent[] => [
  event({ stage: 'ingest', kind: 'stage_started', message: 'Ingest started (pipeline v2)', payload: { pipelineVersion: 'v2' } }),
  event({ stage: 'ingest', kind: 'stage_completed', message: 'Ingest completed in 0.4s' }),
  event({ stage: 'layout', kind: 'stage_started', message: 'Layout started' }),
  event({ kind: 'page_layout', pageNumber: 12, message: 'Page 12: two-column layout, 4 text blocks, 1 art region excluded' }),
  event({ kind: 'page_markdown', pageNumber: 12, message: 'Page 12 Markdown: 412 words, text cleanliness 96.4%' }),
  event({ kind: 'quality', message: 'Text cleanliness 88.0% average over 2 pages; 1 below 90.0%: p. 7', payload: { average: 0.88, lowPages: [7] } }),
  event({ kind: 'stage_completed', message: 'Layout completed in 12.1s' }),
  event({
    stage: 'extract',
    kind: 'stage_started',
    message: 'Extraction started: 1 candidate (1 monster, 0 spell, 0 item) via qwen2.5vl:7b',
    payload: {
      model: 'qwen2.5vl:7b',
      candidates: [
        { key: 'monster:p12:p12-b4', type: 'monster', title: 'Gorgon', pageNumber: 12, regions: [{ pageNumber: 12, blockIds: ['p12-b4'], bbox: [0.52, 0.06, 0.94, 0.5] }] },
      ],
    },
  }),
  gorgonEvent(),
]
