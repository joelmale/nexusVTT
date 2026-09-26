import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import Processing from './Processing'
import { json, meWith, renderPage, stubFetch } from '../test/utils'

const STATS_PATH = '/control-api/v1/codex/admin/queue/stats'
const JOBS_PATH = '/control-api/v1/codex/admin/queue/jobs'
const REPORT_PATH = '/control-api/v1/codex/admin/processing/report/doc-1'

const mockStats = {
  waiting: 1,
  active: 1,
  completed: 8,
  failed: 0,
}

const mockJobs = {
  jobs: [
    {
      id: 'job-1',
      documentId: 'doc-1',
      documentTitle: 'Dungeon Master Basic Rules',
      stage: 'render',
      status: 'active',
      progress: 40,
      attempts: 1,
      createdAt: Date.now() - 60000,
    },
    {
      id: 'job-2',
      documentId: 'doc-2',
      documentTitle: 'Players Handbook Excerpt',
      stage: 'ocr',
      status: 'completed',
      progress: 100,
      attempts: 1,
      createdAt: Date.now() - 120000,
    },
  ],
  total: 2,
}

const mockReport = {
  document: {
    id: 'doc-1',
    title: 'Dungeon Master Basic Rules',
    format: 'pdf',
    fileSize: 15485760,
    pageCount: 64,
    ocrStatus: 'processing',
    searchIndex: null,
  },
  processing: {
    format: 'pdf',
    stage: 'render',
    textLength: 124,
    textSample: 'D&D 5th Edition Basic Rules Frontmatter',
    checkpoints: {
      contentHash: 'b5a8c9d1e2f3',
      stages: {
        ingest: { completedAt: '2026-09-26T12:00:00Z', durationMs: 140 },
      },
    },
    ocr: {
      detected: true,
      performed: false,
      status: 'pending',
      reason: 'Image-based PDF detected',
    },
    layout: {
      pages: [{ pageNumber: 1, columns: 2, confidence: 0.8 }],
    },
  },
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function stubProcessingApi() {
  return stubFetch([
    ['GET', STATS_PATH, () => json(200, mockStats)],
    ['GET', JOBS_PATH, () => json(200, mockJobs)],
    ['GET', REPORT_PATH, () => json(200, mockReport)],
    ['GET', '/control-api/v1/codex/admin/processing/report/doc-2', () => json(200, {
      ...mockReport,
      document: { ...mockReport.document, id: 'doc-2', title: 'Players Handbook Excerpt' },
    })],
  ])
}

describe('Processing Page', () => {
  it('renders queue stats, job list, and pipeline architecture graph', async () => {
    stubProcessingApi()
    renderPage(<Processing />, { me: meWith('platform_admin') })

    // Page title and queue stats cards
    expect(await screen.findByText('Processing Queue')).toBeDefined()
    expect((await screen.findAllByText('Waiting')).length).toBeGreaterThan(0)
    expect((await screen.findAllByText('Active')).length).toBeGreaterThan(0)
    expect((await screen.findAllByText('Completed')).length).toBeGreaterThan(0)
    expect((await screen.findAllByText('Failed')).length).toBeGreaterThan(0)

    // Pipeline Hero section
    expect(await screen.findByText('Pipeline Architecture & Live Status')).toBeDefined()
    expect(screen.getByText('Document Processing Graph')).toBeDefined()

    // Job table entries
    expect((await screen.findAllByText(/Dungeon Master Basic Rules/)).length).toBeGreaterThan(0)
    expect((await screen.findAllByText(/Players Handbook Excerpt/)).length).toBeGreaterThan(0)

    // Pipeline nodes
    expect(screen.getByTestId('node-ingest')).toBeDefined()
    expect(screen.getByTestId('node-render')).toBeDefined()
    expect(screen.getByTestId('node-ocr')).toBeDefined()
    expect(screen.getByTestId('node-extract')).toBeDefined()
    expect(screen.getByTestId('node-index')).toBeDefined()
    expect(screen.getByTestId('node-assets')).toBeDefined()
  })

  it('allows switching inspected document via table inspect button', async () => {
    stubProcessingApi()
    renderPage(<Processing />, { me: meWith('platform_admin') })

    const inspectButtons = await screen.findAllByRole('button', { name: /inspect/i })
    expect(inspectButtons.length).toBeGreaterThan(0)

    // Click inspect on the second row
    fireEvent.click(inspectButtons[1])

    // Should update inspected state
    expect(screen.getAllByText('Players Handbook Excerpt').length).toBeGreaterThan(0)
  })

  it('opens details modal featuring full pipeline graph when clicking details', async () => {
    stubProcessingApi()
    renderPage(<Processing />, { me: meWith('platform_admin') })

    const detailsButtons = await screen.findAllByRole('button', { name: /details/i })
    expect(detailsButtons.length).toBeGreaterThan(0)

    fireEvent.click(detailsButtons[0])

    // Modal opens with pipeline inspector title
    expect(await screen.findByText(/Pipeline Details - Dungeon Master Basic Rules/i)).toBeDefined()
  })
})
