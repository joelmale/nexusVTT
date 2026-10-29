import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import Documents from './Documents'
import { json, meWith, renderPage, stubFetch } from '../test/utils'

const DOCS_PATH = '/control-api/v1/codex/admin/documents'
const STATS_PATH = '/control-api/v1/codex/admin/queue/stats'

const mockDocs = {
  documents: [
    {
      id: 'doc-phb',
      title: "Player's Handbook",
      type: 'rulebook',
      format: 'pdf',
      status: 'completed',
      fileSize: 42100000,
      uploadedAt: '2026-10-28T18:00:00.000Z',
      tags: ['core', '5e'],
      processingSummary: {
        textLength: 350000,
        ocrStatus: 'completed',
        isIndexed: true,
        pageImagesCount: 320,
        pageImagesTotalBytes: 15000000,
      },
    },
    {
      id: 'doc-dmg',
      title: "Dungeon Master's Guide",
      type: 'rulebook',
      format: 'pdf',
      status: 'processing',
      fileSize: 38500000,
      uploadedAt: '2026-10-28T18:30:00.000Z',
      tags: ['core', '5e', 'magic-items'],
      processingSummary: {
        textLength: 120000,
        ocrStatus: 'processing',
        isIndexed: false,
      },
    },
  ],
  pagination: {
    page: 1,
    limit: 50,
    total: 2,
    totalPages: 1,
  },
}

const mockStats = {
  waiting: 0,
  active: 1,
  completed: 5,
  failed: 0,
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function stubDocumentsApi() {
  return stubFetch([
    ['GET', DOCS_PATH, () => json(200, mockDocs)],
    ['GET', STATS_PATH, () => json(200, mockStats)],
    ['GET', '/control-api/v1/codex/deduplication/duplicates', () => json(200, { duplicates: [], totalGroups: 0, totalDocuments: 0 })],
    ['GET', '/control-api/v1/codex/admin/data-quality/validate', () => json(200, {
      orphanedFiles: { orphanedDocuments: [], total: 0 },
      metadataInconsistencies: { inconsistentDocuments: [], total: 0 },
      searchIndexIssues: { searchIndexIssues: [], total: 0 },
      summary: { totalOrphaned: 0, totalMetadataIssues: 0, totalSearchIndexIssues: 0, totalIssues: 0 },
    })],
    ['GET', '/control-api/v1/codex/admin/queue/jobs', () => json(200, { jobs: [], total: 0 })],
  ])
}

describe('Documents Page Consolidation', () => {
  it('renders catalog table with documents and sub-view navigation tabs', async () => {
    stubDocumentsApi()
    renderPage(<Documents />, { me: meWith('platform_admin') })

    // Sub-view tabs
    expect(await screen.findByRole('button', { name: /All Documents/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Queue & Processing/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Duplicates/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Quality Audit/i })).toBeDefined()

    // Documents in catalog table
    expect(await screen.findByText("Player's Handbook")).toBeDefined()
    expect(screen.getByText("Dungeon Master's Guide")).toBeDefined()
    expect(screen.getByText('Upload Documents')).toBeDefined()
  })

  it('toggles the embedded drag-and-drop bulk upload zone when clicking upload', async () => {
    stubDocumentsApi()
    renderPage(<Documents />, { me: meWith('content_editor') })

    const uploadBtn = await screen.findByRole('button', { name: /Upload Documents/i })
    fireEvent.click(uploadBtn)

    // The upload zone opens with drag-and-drop area and file input
    expect(await screen.findByText(/Drop PDF or Markdown files here/i)).toBeDefined()
    expect(screen.getByLabelText('Documents to upload')).toBeDefined()

    // Toggle button changes to Hide Upload
    expect(screen.getByRole('button', { name: /Hide Upload/i })).toBeDefined()

    // Clicking Hide Upload closes it
    fireEvent.click(screen.getByRole('button', { name: /Hide Upload/i }))
    expect(screen.queryByText(/Drop PDF or Markdown files here/i)).toBeNull()
  })

  it('switches to Duplicates and Quality Audit sub-views smoothly', async () => {
    stubDocumentsApi()
    renderPage(<Documents />, { me: meWith('platform_admin') })

    // Click Duplicates sub-tab
    const duplicatesTab = await screen.findByRole('button', { name: /Duplicates/i })
    fireEvent.click(duplicatesTab)

    expect(await screen.findByText(/Document Deduplication/i)).toBeDefined()

    // Click Quality Audit sub-tab
    const qualityTab = screen.getByRole('button', { name: /Quality Audit/i })
    fireEvent.click(qualityTab)

    expect(await screen.findByText(/Data Quality Validation/i)).toBeDefined()
  })

  it('opens edit document modal when edit action is clicked', async () => {
    stubDocumentsApi()
    renderPage(<Documents />, { me: meWith('platform_admin') })

    const editButtons = await screen.findAllByRole('button', { name: /^Edit$/i })
    expect(editButtons.length).toBeGreaterThan(0)

    fireEvent.click(editButtons[0])

    expect(await screen.findByRole('heading', { name: 'Edit Document' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDefined()
  })
})

