import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActionFeed, FEED_FLUSH_MS } from './ActionFeed'
import { event, liveRunEvents } from './__fixtures__'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('ActionFeed', () => {
  it('renders an ARIA log of timestamped, source-tagged sentences', () => {
    render(<ActionFeed events={liveRunEvents()} />)
    const log = screen.getByRole('log', { name: 'Processing events' })
    expect(log.getAttribute('aria-live')).toBe('polite')
    expect(log.textContent).toContain('Page 12: two-column layout, 4 text blocks, 1 art region excluded')
    expect(log.textContent).toContain('qwen2.5vl:7b: extracted Gorgon (AC 19, HP 114, CR 5), all values grounded')
    const extracted = log.querySelector('[data-kind="entity_extracted"]')!
    expect(extracted.textContent).toContain('VLM:')
    expect(log.querySelector('[data-kind="page_layout"]')!.textContent).toContain('Surya Layout:')
    expect(log.querySelector('[data-kind="page_markdown"]')!.textContent).toContain('Marker:')
    expect(extracted.querySelector('time')!.getAttribute('datetime')).toBe('2026-09-28T14:02:11.000Z')
  })

  it('labels failures in text, not colour alone', () => {
    render(<ActionFeed events={[event({ stage: 'layout', kind: 'stage_failed', message: 'Layout failed: ocr-service unreachable' })]} />)
    const line = screen.getByRole('log').querySelector('[data-kind="stage_failed"]')!
    expect(line.textContent).toContain('FAILED')
    expect(line.textContent).toContain('LAYOUT')
  })

  it('throttles new lines into batches so screen readers are not flooded', () => {
    vi.useFakeTimers()
    const initial = liveRunEvents().slice(0, 3)
    const { rerender } = render(<ActionFeed events={initial} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)

    // Leading edge: the first new line after a quiet spell appears at once.
    const burst1 = [...initial, event({ kind: 'page_layout', pageNumber: 1, message: 'Page 1: one-column layout, 3 text blocks' })]
    rerender(<ActionFeed events={burst1} />)
    act(() => vi.advanceTimersByTime(0))
    expect(screen.getAllByRole('listitem')).toHaveLength(4)

    // Lines arriving within the interval wait and are then added as one batch.
    const burst2 = [...burst1, event({ kind: 'page_layout', pageNumber: 2, message: 'Page 2: one-column layout, 5 text blocks' })]
    const burst3 = [...burst2, event({ kind: 'page_markdown', pageNumber: 2, message: 'Page 2 Markdown: 300 words' })]
    act(() => vi.advanceTimersByTime(300))
    rerender(<ActionFeed events={burst2} />)
    act(() => vi.advanceTimersByTime(300))
    rerender(<ActionFeed events={burst3} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(4)

    act(() => vi.advanceTimersByTime(FEED_FLUSH_MS))
    expect(screen.getAllByRole('listitem')).toHaveLength(6) // one batch, both lines
  })

  it('shows a new run immediately', () => {
    vi.useFakeTimers()
    const { rerender } = render(<ActionFeed events={liveRunEvents()} />)
    rerender(<ActionFeed events={[event({ stage: 'ingest', message: 'Ingest started (pipeline v2)' })]} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('keeps the raw job log behind a toggle', () => {
    render(<ActionFeed events={liveRunEvents()} rawLogs={<p>raw redis log line</p>} />)
    expect(screen.queryByText('raw redis log line')).toBeNull()
    const toggle = screen.getByRole('button', { name: 'Raw logs' })
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('raw redis log line')).toBeTruthy()
    expect(screen.queryByRole('log')).toBeNull()
  })

  it('prefixes worker, GPU and index lines with their source and pins a status line', () => {
    render(
      <ActionFeed
        statusLine={<span>NVIDIA RTX A2000: VRAM 4.4 / 6.0 GB (73%)</span>}
        events={[
          event({ stage: 'extract', kind: 'crop_dispatched', message: 'Cropped stat block "Gorgon" [x: 48, y: 190, w: 520, h: 640] -> dispatched to Ollama (qwen2.5vl:7b)' }),
          event({ stage: 'extract', kind: 'telemetry', message: 'NVIDIA RTX A2000: VRAM 4.4 / 6.0 GB (73%) | Compute 91% | Temp 62°C' }),
          event({ stage: 'index', kind: 'step_completed', message: '12 page-aware chunks embedded', payload: { step: 'chunking' } }),
        ]}
      />
    )
    const log = screen.getByRole('log')
    expect(log.querySelector('[data-kind="crop_dispatched"]')!.textContent).toContain('Worker:')
    expect(log.querySelector('[data-kind="telemetry"]')!.textContent).toContain('GPU:')
    expect(log.querySelector('[data-kind="step_completed"]')!.textContent).toContain('Chunker:')
    expect(screen.getByText('NVIDIA RTX A2000: VRAM 4.4 / 6.0 GB (73%)')).toBeTruthy()
  })
})
