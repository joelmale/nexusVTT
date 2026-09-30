import { describe, expect, it } from 'vitest'
import { derivePipelineSteps, eventInStep, formatDuration } from './pipeline'
import { event } from './__fixtures__'

const at = (seconds: number) => new Date(Date.UTC(2026, 8, 30, 12, 0, seconds)).toISOString()

describe('derivePipelineSteps (v2)', () => {
  it('reports each step with timing, page progress and pace', () => {
    const steps = derivePipelineSteps(
      [
        event({ stage: 'ingest', kind: 'stage_started', createdAt: at(0), payload: { pipelineVersion: 'v2' } }),
        event({ stage: 'ingest', kind: 'stage_completed', createdAt: at(2) }),
        event({ stage: 'layout', kind: 'stage_started', createdAt: at(3) }),
        event({ stage: 'layout', kind: 'page_layout', pageNumber: 1, createdAt: at(10), payload: { totalPages: 48, secondsPerPage: 2.31 } }),
        event({ stage: 'layout', kind: 'page_layout', pageNumber: 2, createdAt: at(12), payload: { totalPages: 48, secondsPerPage: 2.31 } }),
      ],
      'v2'
    )
    expect(steps.map((s) => [s.id, s.status])).toEqual([
      ['preflight', 'done'],
      ['layout', 'active'],
      ['vlm', 'pending'],
      ['chunking', 'pending'],
      ['indexing', 'pending'],
    ])
    expect(steps[0].endedAt! - steps[0].startedAt!).toBe(2000)
    expect(steps[1].detail).toBe('Page 2/48 · 2.3 s/page')
    expect(steps[1].progress).toBeCloseTo(2 / 48)
  })

  it('splits the index stage into chunking and indexing sub-steps', () => {
    const steps = derivePipelineSteps(
      [
        event({ stage: 'index', kind: 'stage_started', createdAt: at(0), payload: { pipelineVersion: 'v2' } }),
        event({ stage: 'index', kind: 'step_started', createdAt: at(0), payload: { step: 'chunking' } }),
        event({ stage: 'index', kind: 'step_completed', createdAt: at(4), payload: { step: 'chunking', count: 124 } }),
        event({ stage: 'index', kind: 'step_started', createdAt: at(4), payload: { step: 'indexing' } }),
      ],
      'v2'
    )
    const byId = Object.fromEntries(steps.map((s) => [s.id, s]))
    expect(byId.chunking).toMatchObject({ status: 'done', detail: '124 chunks' })
    expect(byId.indexing.status).toBe('active')

    const done = derivePipelineSteps([event({ stage: 'index', kind: 'stage_completed', createdAt: at(9) })], 'v2')
    expect(done.find((s) => s.id === 'chunking')!.status).toBe('skipped')
    expect(done.find((s) => s.id === 'indexing')!.status).toBe('done')
  })

  it('marks the failing step, and counts settled candidates', () => {
    const steps = derivePipelineSteps(
      [
        event({ stage: 'extract', kind: 'stage_started', createdAt: at(0), payload: { candidates: [{}, {}, {}] } }),
        event({ stage: 'extract', kind: 'entity_rejected', createdAt: at(1) }),
        event({ stage: 'extract', kind: 'stage_failed', createdAt: at(2) }),
      ],
      'v2'
    )
    expect(steps.find((s) => s.id === 'vlm')).toMatchObject({ status: 'failed', detail: '1/3 candidates' })
  })

  it('assets never reopen the finished index step', () => {
    const steps = derivePipelineSteps(
      [
        event({ stage: 'index', kind: 'stage_completed', createdAt: at(0) }),
        event({ stage: 'assets', kind: 'stage_started', createdAt: at(1) }),
      ],
      'v2'
    )
    expect(steps.find((s) => s.id === 'indexing')!.status).toBe('done')
  })
})

describe('pipeline helpers', () => {
  it('uses the v1 stages for a v1 run', () => {
    expect(derivePipelineSteps([], 'v1').map((s) => s.engine)).toContain('RapidOCR')
  })

  it('assigns events to steps', () => {
    expect(eventInStep(event({ stage: 'index', kind: 'step_started', payload: { step: 'chunking' } }), 'chunking', 'v2')).toBe(true)
    expect(eventInStep(event({ stage: 'index', kind: 'step_started', payload: { step: 'chunking' } }), 'indexing', 'v2')).toBe(false)
    expect(eventInStep(event({ stage: 'layout', kind: 'page_layout' }), 'layout', 'v2')).toBe(true)
  })

  it('formats durations', () => {
    expect(formatDuration(4_400)).toBe('4s')
    expect(formatDuration(125_000)).toBe('2m 05s')
    expect(formatDuration(3_725_000)).toBe('1h 02m')
  })
})
