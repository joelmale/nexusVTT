import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OverlayLegend, PageOverlay } from './PageOverlay'
import { scaleBBox } from './overlay'
import { BLOCKS } from './__fixtures__'

afterEach(() => cleanup())

const rectOf = (testId: string) => screen.getByTestId(testId).querySelector('rect')!
const attrs = (rect: Element) => ['x', 'y', 'width', 'height'].map((name) => Number(rect.getAttribute(name)))

describe('PageOverlay', () => {
  it('scales normalized bboxes onto the page size in points', () => {
    render(<PageOverlay pageNumber={12} previewUrl="/preview.webp" widthPt={612} heightPt={792} blocks={BLOCKS} />)

    const svg = screen.getByRole('img', { name: /Layout of page 12/ })
    expect(svg.getAttribute('viewBox')).toBe('0 0 612 792')
    // [0.52, 0.1, 0.94, 0.5] on a 612 x 792 page
    const [x, y, width, height] = attrs(rectOf('block-p12-b4'))
    expect(x).toBeCloseTo(318.24)
    expect(y).toBeCloseTo(79.2)
    expect(width).toBeCloseTo(257.04)
    expect(height).toBeCloseTo(316.8)
    // The container keeps the page aspect ratio so the preview and overlay line up.
    expect(screen.getByTestId('page-overlay').style.aspectRatio).toBe('612 / 792')
  })

  it('uses the same normalized boxes for a different page size (A4)', () => {
    render(<PageOverlay pageNumber={12} previewUrl={null} widthPt={595} heightPt={842} blocks={BLOCKS} />)
    const [x, , , height] = attrs(rectOf('block-p12-b4'))
    expect(x).toBeCloseTo(0.52 * 595)
    expect(height).toBeCloseTo(0.4 * 842)
    expect(screen.getByText('No page preview')).toBeTruthy()
  })

  it('falls back to US Letter when the page size is unknown', () => {
    render(<PageOverlay pageNumber={1} previewUrl={null} blocks={BLOCKS} />)
    expect(screen.getByRole('img', { name: /Layout of page 1/ }).getAttribute('viewBox')).toBe('0 0 612 792')
  })

  it('numbers text blocks in reading order and marks art and furniture as excluded', () => {
    render(<PageOverlay pageNumber={12} previewUrl={null} widthPt={612} heightPt={792} blocks={BLOCKS} />)
    const numbers = ['p12-b1', 'p12-b2', 'p12-b4', 'p12-b5'].map((id) => screen.getByTestId(`block-${id}`).querySelector('text')?.textContent)
    expect(numbers).toEqual(['1', '2', '3', '4'])
    expect(screen.getByTestId('block-p12-b3').querySelector('rect')!.getAttribute('fill')).toBe('url(#overlay-hatch)')
    expect(screen.getAllByText('excluded from text').length).toBeGreaterThan(0)
    // Pattern as well as colour: the sidebar is dotted, tables dashed, text solid.
    expect(rectOf('block-p12-b5').getAttribute('stroke-dasharray')).toBe('2 3')
    expect(rectOf('block-p12-b4').getAttribute('stroke-dasharray')).toBeNull()
  })

  it('outlines extraction candidates with their status and highlights a source region', () => {
    render(
      <PageOverlay
        pageNumber={12}
        previewUrl={null}
        widthPt={612}
        heightPt={792}
        blocks={BLOCKS}
        candidates={[
          { key: 'monster:p12:p12-b4', type: 'monster', title: 'Gorgon', pageNumber: 12, status: 'needs_review', regions: [{ pageNumber: 12, blockIds: ['p12-b4'], bbox: [0.52, 0.06, 0.94, 0.5] }] },
          { key: 'spell:p13:x', type: 'spell', title: 'Fireball', pageNumber: 13, status: 'extracting', regions: [{ pageNumber: 13, blockIds: ['x'], bbox: [0, 0, 1, 1] }] },
        ]}
        highlight={[[0.52, 0.06, 0.94, 0.5]]}
      />
    )
    const candidate = screen.getByTestId('candidate-monster:p12:p12-b4')
    expect(candidate.getAttribute('data-status')).toBe('needs_review')
    expect(candidate.textContent).toBe('MONSTER · needs review')
    expect(screen.queryByTestId('candidate-spell:p13:x')).toBeNull() // other page
    expect(screen.getByTestId('source-highlight')).toBeTruthy()
  })

  it('reports block clicks', () => {
    const onSelect = vi.fn()
    render(<PageOverlay pageNumber={12} previewUrl={null} widthPt={612} heightPt={792} blocks={BLOCKS} onSelectBlock={onSelect} />)
    fireEvent.click(screen.getByTestId('block-p12-b4'))
    expect(onSelect).toHaveBeenCalledWith(BLOCKS[4])
  })
})

describe('OverlayLegend', () => {
  it('names every class in text, not colour alone', () => {
    render(<OverlayLegend />)
    const legend = screen.getByRole('list', { name: 'Overlay legend' })
    for (const label of ['Text & headings (numbered in reading order)', 'Table', 'Stat block', 'Sidebar (heuristic)', 'Art · excluded from text']) {
      expect(legend.textContent).toContain(label)
    }
  })
})

describe('scaleBBox', () => {
  it('never returns negative sizes', () => {
    expect(scaleBBox([0.5, 0.5, 0.4, 0.4], 100, 100)).toEqual({ x: 50, y: 50, width: 0, height: 0 })
  })
})
