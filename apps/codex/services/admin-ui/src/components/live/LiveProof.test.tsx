import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LiveProof from './LiveProof'
import { deriveLiveState } from './useProcessingEvents'
import { API, DOC, PAGE_12, event, gorgonEvent, liveRunEvents } from './__fixtures__'
import { json, meWith, renderPage, requestsTo, stubFetch } from '../../test/utils'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const runs = [
  { runId: 'run-2', firstEventId: '1', lastEventId: '9', startedAt: '2026-09-28T14:02:00.000Z', lastEventAt: '2026-09-28T14:05:00.000Z', events: 9 },
  { runId: 'run-1', firstEventId: '100', lastEventId: '101', startedAt: '2026-09-27T09:00:00.000Z', lastEventAt: '2026-09-27T09:01:00.000Z', events: 2 },
]

function stubLiveApi(events = liveRunEvents()) {
  return stubFetch([
    ['GET', `${API}/events`, (request) => {
      const url = new URL(request.url, 'http://x')
      if (url.searchParams.get('runId') === 'run-1') {
        return json(200, {
          documentId: DOC,
          runId: 'run-1',
          events: [
            event({ runId: 'run-1', stage: 'ingest', message: 'Ingest started (pipeline v2)' }),
            event({ runId: 'run-1', stage: 'layout', kind: 'stage_failed', message: 'Layout failed: ocr-service unreachable' }),
          ],
          nextAfter: '101',
          hasMore: false,
        })
      }
      const after = url.searchParams.get('after')
      return json(200, {
        documentId: DOC,
        runId: 'run-2',
        events: after ? [] : events,
        nextAfter: after ?? events[events.length - 1].id,
        hasMore: false,
        ...(after ? {} : { runs }),
      })
    }],
    ['GET', `${API}/pages`, () => json(200, { documentId: DOC, pages: [{ ...PAGE_12, markdown: undefined, blocks: undefined }, { pageNumber: 13, widthPt: 612, heightPt: 792, hasPreview: false, quality: {}, engine: 'marker@1.10.2' }] })],
    ['GET', `${API}/pages/12`, () => json(200, { documentId: DOC, ...PAGE_12 })],
    ['GET', `${API}/pages/13`, () => json(200, { documentId: DOC, ...PAGE_12, pageNumber: 13, hasPreview: false, blocks: [] })],
  ])
}

const renderLive = (active = false) =>
  renderPage(<LiveProof documentId={DOC} documentTitle="Monster Manual" active={active} />, { me: meWith('auditor') })

describe('LiveProof', () => {
  it('shows the header strip, the latest page with its overlay, and the artifact stream', async () => {
    stubLiveApi()
    renderLive()

    expect(await screen.findByText('Lexicon Match: 88.0% (noisy)')).toBeTruthy()
    expect(document.getElementById('live-proof-title')!.textContent).toBe('CODEX INGESTION ENGINE :: Monster Manual')
    expect(screen.getByText('VLM: qwen2.5vl:7b')).toBeTruthy()
    expect(screen.getByTestId('stage-indicator').textContent).toBe('ACTIVE: VLM Entity Parsing')
    expect(screen.getByTestId('step-preflight').getAttribute('data-status')).toBe('done')
    expect(screen.getByTestId('step-layout').getAttribute('data-status')).toBe('done')
    expect(screen.getByTestId('step-vlm').textContent).toContain('1/1 candidates')
    expect(screen.getByTestId('artifact-footer').textContent).toBe('[JSON Schema: Valid][Parsed: 1 Entity]')

    const img = (await screen.findByAltText('Page 12 preview')) as HTMLImageElement
    expect(img.getAttribute('src')).toBe(`${API}/pages/12/preview`) // streamed by control-api, never presigned
    expect(screen.getByTestId('candidate-monster:p12:p12-b4').getAttribute('data-status')).toBe('extracted')
    expect(screen.getByRole('article', { name: 'monster Gorgon' })).toBeTruthy()
    expect(screen.getByText('Page 12 Markdown')).toBeTruthy()
  })

  it('stacks the split view below 1024px (Tailwind lg breakpoint)', async () => {
    stubLiveApi()
    renderLive()
    const split = await screen.findByTestId('live-proof-split')
    expect(split.className).toContain('grid-cols-1')
    expect(split.className).toContain('lg:grid-cols-2')
    // Page first, artifact stream second in document order: on top / underneath when stacked.
    const [left, right] = Array.from(split.children)
    expect(within(left as HTMLElement).queryByTestId('page-overlay') ?? left.textContent).toBeTruthy()
    expect(right.textContent).toContain('Artifact stream')
  })

  it('"Show source" jumps to the page, stops following live and highlights the region', async () => {
    stubLiveApi([...liveRunEvents().slice(0, 8), event({ kind: 'page_layout', stage: 'layout', pageNumber: 13, message: 'Page 13' }), gorgonEvent()])
    renderLive()
    await waitFor(() => expect((screen.getByLabelText('Page') as HTMLSelectElement).value).toBe('13'))

    fireEvent.click(await screen.findByRole('button', { name: 'Show source' }))
    await waitFor(() => expect((screen.getByLabelText('Page') as HTMLSelectElement).value).toBe('12'))
    expect((screen.getByLabelText('Follow live') as HTMLInputElement).checked).toBe(false)
    expect(await screen.findByTestId('source-highlight')).toBeTruthy()
  })

  it('shows a clicked block\'s Markdown next to the page', async () => {
    stubLiveApi()
    renderLive()
    fireEvent.click(await screen.findByTestId('block-p12-b4'))
    expect(screen.getByTestId('selected-block').textContent).toContain('**Armor Class** 19')
  })

  it('does not animate new cards when the viewer prefers reduced motion', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    stubLiveApi()
    renderLive()
    const card = await screen.findByRole('article', { name: 'monster Gorgon' })
    expect(card.className).not.toContain('animate-pulse')
  })

  it('replays an earlier run from its events', async () => {
    const fetchMock = stubLiveApi()
    renderLive()
    const runSelect = (await screen.findByLabelText('Replay a run')) as HTMLSelectElement
    await waitFor(() => expect(runSelect.options.length).toBe(3))

    fireEvent.change(runSelect, { target: { value: 'run-1' } })
    expect(await screen.findByLabelText('Replay controls')).toBeTruthy()
    await waitFor(() => expect(screen.getByRole('log').textContent).toContain('Layout failed: ocr-service unreachable'), { timeout: 3000 })
    expect(requestsTo(fetchMock, 'GET', /events\?.*runId=run-1/)).toHaveLength(1)
  })

  it('polls for new events only while a job is active', async () => {
    const fetchMock = stubLiveApi()
    renderLive(false)
    await screen.findByText('VLM: qwen2.5vl:7b')
    await new Promise((resolve) => setTimeout(resolve, 1700))
    expect(requestsTo(fetchMock, 'GET', `${API}/events`)).toHaveLength(1)
  })
})

describe('LiveProof step filter and banners', () => {
  it('filters the console and artifacts to a clicked step, and clears on a second click', async () => {
    stubLiveApi()
    renderLive()
    await screen.findByRole('article', { name: 'monster Gorgon' })
    fireEvent.click(screen.getByTestId('step-layout'))
    expect(screen.getByTestId('step-layout').getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByRole('article', { name: 'monster Gorgon' })).toBeNull()
    expect(screen.getByText('Page 12 Markdown')).toBeTruthy()
    await waitFor(() => expect(screen.getByRole('log').textContent).not.toContain('extracted Gorgon'))
    fireEvent.click(screen.getByTestId('step-layout'))
    expect(await screen.findByRole('article', { name: 'monster Gorgon' })).toBeTruthy()
  })

  it('says plainly when a run used pipeline v1', async () => {
    stubLiveApi([
      event({ stage: 'ingest', kind: 'stage_started', message: 'Ingest started (pipeline v1)', payload: { pipelineVersion: 'v1' } }),
      event({ stage: 'ocr', kind: 'stage_started', message: 'OCR started', payload: { pipelineVersion: 'v1' } }),
    ])
    renderLive()
    expect(await screen.findByText(/This run used pipeline v1/)).toBeTruthy()
    expect(screen.getByTestId('step-ocr').getAttribute('data-status')).toBe('active')
  })

  it('explains an empty document instead of showing zeros', async () => {
    stubFetch([
      ['GET', `${API}/events`, () => json(200, { documentId: DOC, runId: null, events: [], nextAfter: null, hasMore: false, runs: [] })],
      ['GET', `${API}/pages`, () => json(200, { documentId: DOC, pages: [] })],
    ])
    renderLive()
    expect(await screen.findByText(/No processing events for this document/)).toBeTruthy()
    expect(screen.getByTestId('stage-indicator').textContent).toBe('IDLE')
  })
})

describe('deriveLiveState', () => {
  it('shows stat blocks from page layout before extraction starts', () => {
    const layout = event({
      kind: 'page_layout',
      pageNumber: 12,
      payload: { candidates: [{ key: 'monster:p12:p12-b4', type: 'monster', title: 'Gorgon', pageNumber: 12, regions: [] }] },
    })
    expect(deriveLiveState([layout]).candidates[0]).toMatchObject({ title: 'Gorgon', status: 'detected' })
  })

  it('tracks candidates from queued to extracted / needs review / rejected', () => {
    const events = liveRunEvents()
    expect(deriveLiveState(events.slice(0, 8)).candidates[0].status).toBe('queued')
    const dispatched = event({ stage: 'extract', kind: 'crop_dispatched', payload: { candidateKey: 'monster:p12:p12-b4', model: 'qwen2.5vl:7b' } })
    expect(deriveLiveState([...events.slice(0, 8), dispatched]).candidates[0].status).toBe('extracting')
    expect(deriveLiveState(events).candidates[0]).toMatchObject({ status: 'extracted', confidence: 0.95 })
    const rejected = event({ stage: 'extract', kind: 'entity_rejected', payload: { source: { candidateKey: 'monster:p12:p12-b4' } } })
    expect(deriveLiveState([...events.slice(0, 8), rejected]).candidates[0].status).toBe('rejected')
    const state = deriveLiveState(events)
    expect(state).toMatchObject({ completedPages: [12], quality: { average: 0.88, lowPages: [7] }, model: 'qwen2.5vl:7b', pipelineVersion: 'v2' })
  })
})
