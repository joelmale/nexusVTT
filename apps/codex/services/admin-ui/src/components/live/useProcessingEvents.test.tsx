import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useProcessingEvents } from './useProcessingEvents'
import { API, DOC, event } from './__fixtures__'
import { json, requestsTo, stubFetch } from '../../test/utils'

class FakeEventSource {
  static CLOSED = 2
  static instances: FakeEventSource[] = []
  readyState = 1
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  closed = false
  private listeners = new Map<string, Array<(message: MessageEvent<string>) => void>>()
  constructor(readonly url: string) {
    FakeEventSource.instances.push(this)
  }
  addEventListener(type: string, listener: (message: MessageEvent<string>) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }
  emit(type: string, data: unknown) {
    for (const listener of this.listeners.get(type) ?? []) listener({ data: JSON.stringify(data) } as MessageEvent<string>)
  }
  close() {
    this.closed = true
    this.readyState = 2
  }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  FakeEventSource.instances = []
})

const first = event({ id: '10', stage: 'ingest', kind: 'stage_started', message: 'Ingest started (pipeline v2)' })

function stubInitialLoad() {
  return stubFetch([
    ['GET', `${API}/events`, () => json(200, { documentId: DOC, runId: 'run-2', events: [first], nextAfter: '10', hasMore: false, runs: [] })],
  ])
}

describe('useProcessingEvents live stream', () => {
  it('loads once, then follows the SSE stream from the last event id', async () => {
    vi.stubGlobal('EventSource', FakeEventSource)
    const fetchMock = stubInitialLoad()
    const { result } = renderHook(() => useProcessingEvents(DOC, { active: true }))

    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1))
    const source = FakeEventSource.instances[0]
    expect(source.url).toBe(`${API}/stream?after=10`)
    expect(result.current.transport).toBe('stream')

    act(() => {
      source.emit('meta', { runId: 'run-2' })
      source.emit('processing', event({ id: '11', stage: 'layout', kind: 'stage_started', message: 'Layout started' }))
      source.emit('processing', event({ id: '11', stage: 'layout', kind: 'stage_started', message: 'duplicate' }))
    })
    await waitFor(() => expect(result.current.events.map((e) => e.id)).toEqual(['10', '11']))
    expect(requestsTo(fetchMock, 'GET', `${API}/events`)).toHaveLength(1) // no polling alongside the stream
  })

  it('starts over when the stream reports a new run', async () => {
    vi.stubGlobal('EventSource', FakeEventSource)
    stubInitialLoad()
    const { result } = renderHook(() => useProcessingEvents(DOC, { active: true }))
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1))
    act(() => {
      FakeEventSource.instances[0].emit('meta', { runId: 'run-3' })
      FakeEventSource.instances[0].emit('processing', event({ id: '20', runId: 'run-3', stage: 'ingest', message: 'Ingest started' }))
    })
    await waitFor(() => expect(result.current.events.map((e) => e.id)).toEqual(['20']))
    expect(result.current.runId).toBe('run-3')
  })

  it('falls back to polling when the stream is refused', async () => {
    vi.stubGlobal('EventSource', FakeEventSource)
    stubInitialLoad()
    const { result, unmount } = renderHook(() => useProcessingEvents(DOC, { active: true }))
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1))
    act(() => {
      FakeEventSource.instances[0].readyState = FakeEventSource.CLOSED
      FakeEventSource.instances[0].onerror?.()
    })
    expect(result.current.transport).toBe('poll')
    unmount()
  })

  it('does not open a stream for an idle document', async () => {
    vi.stubGlobal('EventSource', FakeEventSource)
    stubInitialLoad()
    const { result } = renderHook(() => useProcessingEvents(DOC, { active: false }))
    await waitFor(() => expect(result.current.events).toHaveLength(1))
    expect(FakeEventSource.instances).toHaveLength(0)
    expect(result.current.transport).toBe('idle')
  })
})
