import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { PipelineGraph } from './PipelineGraph'

afterEach(() => {
  cleanup()
})

describe('PipelineGraph component', () => {
  const sampleReport = {
    format: 'pdf',
    textLength: 45000,
    textSample: 'This is a sample extracted text from D&D 5e manual...',
    checkpoints: {
      contentHash: 'a1b2c3d4e5f67890abcdef',
      stages: {
        ingest: { completedAt: '2026-09-26T12:00:00Z', durationMs: 120 },
        render: { completedAt: '2026-09-26T12:00:05Z', durationMs: 450 },
        ocr: { completedAt: '2026-09-26T12:00:15Z', durationMs: 2300 },
        extract: { completedAt: '2026-09-26T12:00:20Z', durationMs: 800 },
        index: { completedAt: '2026-09-26T12:00:22Z', durationMs: 250 },
        assets: { completedAt: '2026-09-26T12:00:25Z', durationMs: 600 },
      },
    },
    ocr: {
      detected: true,
      performed: true,
      status: 'completed',
      pagesRendered: 32,
      textLength: 42000,
      reason: 'Image-based PDF detected',
    },
    extraction: {
      spells: 12,
      monsters: 5,
      items: 8,
    },
    search: {
      indexed: true,
      indexId: 'doc_123',
      indexDurationMs: 250,
    },
    pageImages: {
      count: 32,
      totalBytes: 5242880,
    },
    layout: {
      pages: [{ pageNumber: 1, columns: 2, confidence: 0.85 }],
      confidence: 0.85,
    },
  }

  it('renders all 6 pipeline nodes with titles and metrics', () => {
    render(
      <PipelineGraph
        documentTitle="Dungeon Master Basic Rules"
        documentId="doc-test-1"
        format="pdf"
        fileSize={10485760}
        pageCount={32}
        reportProcessing={sampleReport}
      />
    )

    expect(screen.getByText('Dungeon Master Basic Rules')).toBeDefined()
    expect(screen.getByTestId('node-ingest')).toBeDefined()
    expect(screen.getByTestId('node-render')).toBeDefined()
    expect(screen.getByTestId('node-ocr')).toBeDefined()
    expect(screen.getByTestId('node-extract')).toBeDefined()
    expect(screen.getByTestId('node-index')).toBeDefined()
    expect(screen.getByTestId('node-assets')).toBeDefined()

    // Overall progress: 6 of 6 nodes (100%)
    expect(screen.getByText(/6 of 6 nodes/i)).toBeDefined()
    expect(screen.getByText('ALL STAGES COMPLETE')).toBeDefined()
  })

  it('correctly handles bypassed OCR for clean digital text', () => {
    const digitalTextReport = {
      ...sampleReport,
      ocr: {
        detected: false,
        performed: false,
        status: 'not_required',
        reason: 'Text-based document',
      },
    }

    render(
      <PipelineGraph
        documentTitle="Digital Clean Manual"
        format="pdf"
        pageCount={10}
        reportProcessing={digitalTextReport}
      />
    )

    // OCR should be marked as BYPASSED
    expect(screen.getAllByText('BYPASSED').length).toBeGreaterThan(0)
  })

  it('displays active state with spinning indicator during processing', () => {
    render(
      <PipelineGraph
        documentTitle="Active Manual"
        currentStage="render"
        jobStatus="active"
        reportProcessing={{
          checkpoints: {
            stages: {
              ingest: { completedAt: '2026-09-26T12:00:00Z', durationMs: 150 },
            },
          },
        }}
      />
    )

    expect(screen.getAllByText('RUNNING').length).toBeGreaterThan(0)
    expect(screen.getAllByText('IN PROGRESS').length).toBeGreaterThan(0)
  })

  it('displays failed state and allows retrying a failed stage', () => {
    const onRetry = vi.fn()

    render(
      <PipelineGraph
        documentTitle="Failed OCR Manual"
        currentStage="ocr"
        jobStatus="failed"
        reportProcessing={{
          checkpoints: {
            stages: {
              ingest: { completedAt: '2026-09-26T12:00:00Z', durationMs: 150 },
              render: { completedAt: '2026-09-26T12:00:05Z', durationMs: 200 },
              ocr: { error: 'RapidOCR worker connection refused' },
            },
          },
        }}
        onRetryStage={onRetry}
      />
    )

    expect(screen.getAllByText('FAILED').length).toBeGreaterThan(0)
    expect(screen.getByText('ATTENTION REQUIRED')).toBeDefined()

    // Click OCR node to open inspector
    fireEvent.click(screen.getByTestId('node-ocr'))

    // The retry stage button should be available in inspector
    const retryBtn = screen.getByRole('button', { name: /retry stage/i })
    expect(retryBtn).toBeDefined()

    fireEvent.click(retryBtn)
    expect(onRetry).toHaveBeenCalledWith('ocr')
  })

  it('allows clicking nodes to inspect stage-specific insights', () => {
    render(
      <PipelineGraph
        documentTitle="Inspectable Manual"
        reportProcessing={sampleReport}
      />
    )

    // Click Entity Extraction node
    fireEvent.click(screen.getByTestId('node-extract'))

    // Inspector should show extracted D&D entities
    expect(screen.getByText(/D&D Entities:/i)).toBeDefined()
    expect(screen.getByText(/Spells: 12 \| Monsters: 5 \| Items: 8/i)).toBeDefined()

    // Click GPU OCR node
    fireEvent.click(screen.getByTestId('node-ocr'))
    expect(screen.getByText(/RapidOCR Python Sidecar/i)).toBeDefined()
    expect(screen.getByText(/NVIDIA GPU Acceleration/i)).toBeDefined()

    // Click Search Index node
    fireEvent.click(screen.getByTestId('node-index'))
    expect(screen.getByText(/Elasticsearch:/i)).toBeDefined()
    expect(screen.getAllByText(/documents/i).length).toBeGreaterThan(0)
  })
})
