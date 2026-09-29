import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GoldsetEditor } from './GoldsetEditor'
import { PageOverlay } from './PageOverlay'
import { buildDraftLabel, clampBBox, parseLabel, validateLabel, type GoldLabel, type StructuredDataRow } from './goldset'
import { DOC, PAGE_12 } from './__fixtures__'
import { json, stubFetch } from '../../test/utils'

const HASH = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'

const ROWS: StructuredDataRow[] = [
  {
    type: 'monster',
    name: 'Gorgon',
    pageNumber: 12,
    data: {
      name: 'Gorgon',
      armorClass: 19,
      hitPoints: 114,
      review: { status: 'auto', confidence: 0.95, reasons: [] },
      source: { pageNumber: 12, blockIds: ['p12-b4'], regions: [{ pageNumber: 12, blockIds: ['p12-b4'], bbox: [0.52, 0.06, 0.94, 0.5] }] },
      confidence: 0.95,
      needsReview: false,
      rawSnippet: '...',
    },
  },
  { type: 'spell', name: 'Fireball', pageNumber: 13, data: { name: 'Fireball', level: 3 } },
  { type: 'monster', name: 'Unparsed monster (p. 12)', pageNumber: 12, data: { review: { status: 'needs_review', reasons: ['schema_invalid'] } } },
]

// This jsdom build has no Storage; the editor treats storage as optional, the tests use a memory one.
const memoryStorage = () => {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
    clear: () => values.clear(),
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('buildDraftLabel', () => {
  it('drafts text, boxes and entities from the pipeline output, marked as an unverified draft', () => {
    const label = buildDraftLabel({ page: PAGE_12, contentHash: HASH, rows: ROWS, documentTitle: 'Monster Manual' })
    expect(label).toMatchObject({
      id: 'abcdef01-p12',
      source: { sha256: HASH, pageNumber: 12, title: 'Monster Manual' },
      category: 'monster_stat_block',
      status: 'draft',
      heldOut: false,
      review: { numbersChecked: false, verifiedBy: null },
    })
    // Reading order from the text blocks; the page header and the art are excluded.
    expect(label.text.split('\n\n')).toEqual(['## Gorgons', 'Covered in plates of iron…', '**Armor Class** 19', 'Variant: Gorgon Herds'])
    expect(label.regions).toEqual([
      { class: 'art', bbox: [0.06, 0.62, 0.45, 0.95] },
      { class: 'sidebar', bbox: [0.52, 0.6, 0.94, 0.8] },
      { class: 'stat_block', bbox: [0.52, 0.06, 0.94, 0.5] },
    ])
    // Only this page, no schema-invalid placeholders, no pipeline-only fields.
    expect(label.entities).toEqual([
      { type: 'monster', data: { name: 'Gorgon', armorClass: 19, hitPoints: 114 }, numbersChecked: false },
    ])
  })
})

describe('validateLabel', () => {
  const draft = () => buildDraftLabel({ page: PAGE_12, contentHash: HASH, rows: ROWS })

  it('accepts a draft', () => {
    expect(validateLabel(draft())).toEqual([])
  })

  it('refuses to mark a page verified before the second pass on numbers', () => {
    const verified: GoldLabel = { ...draft(), status: 'verified' }
    expect(validateLabel(verified)).toEqual([
      'verified pages need the second pass on numbers (numbersChecked)',
      'numbers not checked for: Gorgon',
      'verifiedBy is required for verified pages',
    ])
  })

  it('flags bad ids and empty boxes', () => {
    const bad = { ...draft(), id: 'Bad ID', regions: [{ class: 'table' as const, bbox: [0.5, 0.5, 0.5, 0.9] as [number, number, number, number] }] }
    expect(validateLabel(bad)).toEqual(['id must be 3-64 lower-case letters, digits or hyphens', 'region 1: bbox has no area'])
  })

  it('clamps and orders boxes', () => {
    expect(clampBBox([0.9, 1.2, 0.1, -0.1])).toEqual([0.1, 0, 0.9, 1])
  })

  it('parses only label-shaped JSON', () => {
    expect(() => parseLabel('{"hello": 1}')).toThrow('Not a gold-set label')
    expect(parseLabel(JSON.stringify(draft())).id).toBe('abcdef01-p12')
  })
})

function Harness() {
  const [label, setLabel] = useState<GoldLabel | null>(null)
  const [region, setRegion] = useState<number | null>(null)
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PageOverlay
        pageNumber={12}
        previewUrl={null}
        widthPt={612}
        heightPt={792}
        blocks={PAGE_12.blocks}
        goldRegions={label?.regions}
        selectedGoldRegion={region}
        onSelectGoldRegion={setRegion}
        onDrawBox={label ? (bbox) => setLabel({ ...label, regions: [...label.regions, { class: 'stat_block', bbox }] }) : undefined}
      />
      <GoldsetEditor documentId={DOC} contentHash={HASH} page={PAGE_12} label={label} onChange={setLabel} selectedRegion={region} onSelectRegion={setRegion} />
    </QueryClientProvider>
  )
}

describe('GoldsetEditor', () => {
  beforeEach(() => {
    stubFetch([['GET', `/control-api/v1/codex/documents/${DOC}/structured-data`, () => json(200, ROWS)]])
  })

  it('drafts from the pipeline, edits, and downloads the label JSON', async () => {
    const created: Blob[] = []
    vi.stubGlobal('URL', { ...URL, createObjectURL: (blob: Blob) => (created.push(blob), 'blob:label'), revokeObjectURL: () => {} })
    render(<Harness />)

    const draftButton = await screen.findByRole('button', { name: /Draft from pipeline/ })
    await waitFor(() => expect((draftButton as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(draftButton)

    const text = screen.getByLabelText(/Reading-order text/) as HTMLTextAreaElement
    fireEvent.change(text, { target: { value: 'Gorgons\n\nCovered in plates of iron.' } })
    fireEvent.change(screen.getByLabelText('Region 2 class'), { target: { value: 'table' } })
    fireEvent.change(screen.getByLabelText('Region 1 x0'), { target: { value: '0.08' } })

    fireEvent.click(screen.getByRole('button', { name: 'Download label JSON' }))
    const blobText = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.readAsText(created[0])
    })
    const saved = JSON.parse(blobText) as GoldLabel
    expect(saved.text).toBe('Gorgons\n\nCovered in plates of iron.')
    expect(saved.regions[1].class).toBe('table')
    expect(saved.regions[0].bbox[0]).toBe(0.08)
    expect(saved.$schema).toBe('../label.schema.json')
  })

  it('keeps entity JSON edits and reports invalid JSON without losing the entity', async () => {
    render(<Harness />)
    const draftButton = await screen.findByRole('button', { name: /Draft from pipeline/ })
    await waitFor(() => expect((draftButton as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(draftButton)

    const data = screen.getByLabelText('Entity 1 data (JSON)')
    fireEvent.change(data, { target: { value: '{ not json' } })
    fireEvent.blur(data)
    expect(screen.getByRole('alert').textContent).toBeTruthy()

    fireEvent.change(data, { target: { value: '{"name": "Gorgon", "armorClass": 19, "hitPoints": 114}' } })
    fireEvent.blur(data)
    fireEvent.click(within(screen.getByTestId('gold-entity-0')).getByLabelText('Numbers checked'))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('verifying requires the numbers pass and a reviewer', async () => {
    render(<Harness />)
    const draftButton = await screen.findByRole('button', { name: /Draft from pipeline/ })
    await waitFor(() => expect((draftButton as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(draftButton)
    fireEvent.change(screen.getByLabelText('Label status'), { target: { value: 'verified' } })

    const problems = screen.getByLabelText('Label problems')
    expect(problems.textContent).toContain('second pass on numbers')
    expect((screen.getByRole('button', { name: 'Download label JSON' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByLabelText('Second pass on numbers done'))
    fireEvent.click(within(screen.getByTestId('gold-entity-0')).getByLabelText('Numbers checked'))
    fireEvent.change(screen.getByLabelText('Verified by'), { target: { value: 'joel' } })
    expect(screen.queryByLabelText('Label problems')).toBeNull()
    expect((screen.getByRole('button', { name: 'Download label JSON' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('draws a new region by dragging on the page and selects boxes', async () => {
    render(<Harness />)
    const draftButton = await screen.findByRole('button', { name: /Draft from pipeline/ })
    await waitFor(() => expect((draftButton as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(draftButton)

    const svg = screen.getByRole('img', { name: /Layout of page 12/ })
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 612, height: 792, right: 612, bottom: 792, x: 0, y: 0, toJSON: () => ({}) })
    fireEvent.pointerDown(svg, { clientX: 61.2, clientY: 79.2 })
    fireEvent.pointerMove(svg, { clientX: 183.6, clientY: 158.4 })
    expect(screen.getByTestId('drawing-box')).toBeTruthy()
    fireEvent.pointerUp(svg, { clientX: 306, clientY: 396 })

    expect(screen.getByTestId('gold-region-3')).toBeTruthy()
    expect((screen.getByLabelText('Region 4 x0') as HTMLInputElement).value).toBe('0.1')
    expect((screen.getByLabelText('Region 4 y1') as HTMLInputElement).value).toBe('0.5')

    fireEvent.click(screen.getByTestId('gold-box-3'))
    expect(screen.getByTestId('gold-region-3').className).toContain('border-yellow-400')
  })

  it('opens an existing label file', async () => {
    render(<Harness />)
    const file = new File([JSON.stringify(buildDraftLabel({ page: PAGE_12, contentHash: HASH, rows: [] }))], 'label.json', { type: 'application/json' })
    fireEvent.change(screen.getByLabelText('Label file'), { target: { files: [file] } })
    expect(await screen.findByDisplayValue('abcdef01-p12')).toBeTruthy()
  })

  it('restores a browser-local draft for the page', async () => {
    const draft = { ...buildDraftLabel({ page: PAGE_12, contentHash: HASH, rows: [] }), id: 'restored-draft' }
    window.localStorage.setItem(`codex-goldset-draft:${DOC}:12`, JSON.stringify(draft))
    render(<Harness />)
    expect(await screen.findByDisplayValue('restored-draft')).toBeTruthy()
  })
})
