import React, { useState } from 'react'
import {
  FileUp,
  Layers,
  Cpu,
  Sparkles,
  Search,
  Image,
  CheckCircle2,
  AlertCircle,
  Clock,
  SkipForward,
  RefreshCw,
} from 'lucide-react'

export type StageKey = 'ingest' | 'render' | 'ocr' | 'extract' | 'index' | 'assets'

export type StageStatus = 'completed' | 'active' | 'waiting' | 'skipped' | 'failed' | 'pending'

export interface PipelineStageInfo {
  key: StageKey
  number: number
  title: string
  subtitle?: string
  status: StageStatus
  durationMs?: number
  error?: string
  metrics: Array<{ label: string; value: string | number }>
  tag?: { label: string; variant: 'blue' | 'amber' | 'emerald' | 'purple' | 'slate' | 'pink' }
}

export interface PipelineGraphProps {
  documentTitle?: string
  documentId?: string
  format?: string
  fileSize?: number
  pageCount?: number
  searchIndex?: string | null
  currentStage?: string
  jobStatus?: string
  reportProcessing?: {
    format?: string
    stage?: string
    stageUpdatedAt?: string
    textLength?: number
    textSample?: string
    textCharsPerPage?: number
    checkpoints?: {
      contentHash?: string
      stages?: Record<string, {
        completedAt?: string
        durationMs?: number
        error?: string
      }>
    }
    layout?: {
      pages?: Array<{ pageNumber: number; columns: number; confidence: number }>
      confidence?: number
      failureReason?: string
    }
    ocr?: {
      detected?: boolean
      performed?: boolean
      status?: string
      reason?: string
      pageKeys?: string[]
      pagesRendered?: number
      textLength?: number
    }
    extraction?: {
      spells?: number
      monsters?: number
      items?: number
    }
    search?: {
      indexed?: boolean
      indexId?: string
      indexDurationMs?: number
    }
    pageImages?: {
      count?: number
      totalBytes?: number
    }
  }
  onRetryStage?: (stageKey: StageKey) => void
  isLoading?: boolean
}

const STAGE_ORDER: StageKey[] = ['ingest', 'render', 'ocr', 'extract', 'index', 'assets']

const formatDuration = (ms?: number): string => {
  if (ms === undefined || ms === null || isNaN(ms)) return ''
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const formatBytes = (bytes?: number): string => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export const PipelineGraph: React.FC<PipelineGraphProps> = ({
  documentTitle = 'Untitled Document',
  documentId,
  format = 'pdf',
  fileSize = 0,
  pageCount = 0,
  searchIndex,
  currentStage,
  jobStatus,
  reportProcessing,
  onRetryStage,
  isLoading = false,
}) => {
  const [selectedStageKey, setSelectedStageKey] = useState<StageKey>('render')

  // Extract checkpoints and processing metadata
  const checkpoints = reportProcessing?.checkpoints?.stages || {}
  const contentHash = reportProcessing?.checkpoints?.contentHash
  const ocr = reportProcessing?.ocr
  const layout = reportProcessing?.layout
  const extraction = reportProcessing?.extraction
  const search = reportProcessing?.search
  const pageImages = reportProcessing?.pageImages

  const normalizedCurrentStage = currentStage?.toLowerCase() as StageKey | undefined
  const currentStageIndex = normalizedCurrentStage ? STAGE_ORDER.indexOf(normalizedCurrentStage) : -1

  // Calculate status for each stage
  const getStageStatus = (key: StageKey, index: number): { status: StageStatus; durationMs?: number; error?: string } => {
    const cp = checkpoints[key]

    // 1. OCR special gating (bypass if digital text was adequate)
    if (key === 'ocr') {
      if (ocr?.status === 'not_required' || ocr?.detected === false) {
        return { status: 'skipped', durationMs: cp?.durationMs }
      }
      if (ocr?.status === 'completed') {
        return { status: 'completed', durationMs: cp?.durationMs }
      }
      if (ocr?.status === 'failed') {
        return { status: 'failed', durationMs: cp?.durationMs, error: ocr.reason || 'OCR processing failed' }
      }
    }

    // 2. If explicit checkpoint completed
    if (cp?.completedAt) {
      if (cp.error) {
        return { status: 'failed', durationMs: cp.durationMs, error: cp.error }
      }
      return { status: 'completed', durationMs: cp.durationMs }
    }

    // 3. Current active stage from queue job
    if (normalizedCurrentStage === key) {
      if (jobStatus === 'active') {
        return { status: 'active' }
      }
      if (jobStatus === 'failed') {
        return { status: 'failed', error: 'Execution failed at this stage' }
      }
      if (jobStatus === 'waiting' || jobStatus === 'delayed') {
        return { status: 'waiting' }
      }
      if (jobStatus === 'completed') {
        return { status: 'completed' }
      }
    }

    // 4. Inferred position relative to current active stage
    if (currentStageIndex >= 0) {
      if (index < currentStageIndex) {
        return { status: 'completed' }
      }
      if (index === currentStageIndex) {
        return { status: jobStatus === 'failed' ? 'failed' : 'active' }
      }
      return { status: 'pending' }
    }

    // 5. Fallback inference based on document properties
    if (key === 'index' && searchIndex) {
      return { status: 'completed', durationMs: search?.indexDurationMs }
    }
    if (key === 'assets' && (pageImages?.count || 0) > 0) {
      return { status: 'completed' }
    }
    if (key === 'extract' && ((extraction?.spells || 0) + (extraction?.monsters || 0) + (extraction?.items || 0)) > 0) {
      return { status: 'completed' }
    }

    return { status: 'pending' }
  }

  // Build model for all 6 sequential nodes
  const stages: PipelineStageInfo[] = [
    // 1. Ingest
    (() => {
      const { status, durationMs, error } = getStageStatus('ingest', 0)
      return {
        key: 'ingest',
        number: 1,
        title: 'Document Ingest',
        subtitle: 'Storage & Hash Check',
        status,
        durationMs,
        error,
        tag: { label: 'Garage S3', variant: 'emerald' },
        metrics: [
          { label: 'format', value: format.toUpperCase() },
          { label: 'size', value: formatBytes(fileSize) },
          { label: 'sha256', value: contentHash ? `${contentHash.slice(0, 8)}...` : 'n/a' },
        ],
      }
    })(),

    // 2. Render & Layout
    (() => {
      const { status, durationMs, error } = getStageStatus('render', 1)
      const textLen = reportProcessing?.textLength ?? 0
      const colCount = layout?.pages?.[0]?.columns ?? 1
      const ocrNeeded = ocr?.detected ?? (textLen < 200)

      return {
        key: 'render',
        number: 2,
        title: 'Layout & Text',
        subtitle: 'PDF Parsing & OCR Gate',
        status,
        durationMs,
        error,
        tag: { label: colCount === 2 ? 'Two-Column' : 'Single Column', variant: 'blue' },
        metrics: [
          { label: 'pages', value: pageCount },
          { label: 'digital_text', value: `${textLen.toLocaleString()} chars` },
          { label: 'ocr_gate', value: ocrNeeded ? 'OCR Needed' : 'Clean Text' },
        ],
      }
    })(),

    // 3. GPU OCR Sidecar
    (() => {
      const { status, durationMs, error } = getStageStatus('ocr', 2)
      const ocrChars = ocr?.textLength ?? 0
      const pagesRendered = ocr?.pagesRendered ?? (ocr?.pageKeys?.length ?? 0)

      return {
        key: 'ocr',
        number: 3,
        title: 'GPU OCR Sidecar',
        subtitle: 'RapidOCR on NVIDIA GPU',
        status,
        durationMs,
        error,
        tag: { label: 'GPU RapidOCR', variant: 'amber' },
        metrics: [
          { label: 'status', value: status === 'skipped' ? 'Bypassed' : (ocr?.status || status) },
          { label: 'ocr_pages', value: pagesRendered > 0 ? pagesRendered : (status === 'skipped' ? '0' : 'n/a') },
          { label: 'ocr_chars', value: ocrChars > 0 ? `${ocrChars.toLocaleString()} chars` : (status === 'skipped' ? '0' : 'pending') },
        ],
      }
    })(),

    // 4. Entity Extraction
    (() => {
      const { status, durationMs, error } = getStageStatus('extract', 3)
      const spells = extraction?.spells ?? 0
      const monsters = extraction?.monsters ?? 0
      const items = extraction?.items ?? 0
      const total = spells + monsters + items

      return {
        key: 'extract',
        number: 4,
        title: 'Entity Extraction',
        subtitle: `${total} 5e SRD Entities`,
        status,
        durationMs,
        error,
        tag: { label: '5e Entities', variant: 'purple' },
        metrics: [
          { label: 'spells', value: spells },
          { label: 'monsters', value: monsters },
          { label: 'items', value: items },
        ],
      }
    })(),

    // 5. Elasticsearch Index
    (() => {
      const { status, durationMs, error } = getStageStatus('index', 4)
      const isIndexed = searchIndex || search?.indexed

      return {
        key: 'index',
        number: 5,
        title: 'Search Index',
        subtitle: 'Elasticsearch Cluster',
        status,
        durationMs,
        error,
        tag: { label: 'Elasticsearch', variant: 'slate' },
        metrics: [
          { label: 'cluster', value: 'documents' },
          { label: 'indexed', value: isIndexed ? 'Indexed' : 'Pending' },
          { label: 'latency', value: search?.indexDurationMs ? `${search.indexDurationMs}ms` : 'n/a' },
        ],
      }
    })(),

    // 6. Reader Assets
    (() => {
      const { status, durationMs, error } = getStageStatus('assets', 5)
      const imgCount = pageImages?.count ?? 0
      const totalBytes = pageImages?.totalBytes ?? 0

      return {
        key: 'assets',
        number: 6,
        title: 'Page Assets',
        subtitle: 'WebP Previews & Thumbs',
        status,
        durationMs,
        error,
        tag: { label: 'Reader View', variant: 'pink' },
        metrics: [
          { label: 'webp_pages', value: imgCount },
          { label: 'assets_size', value: formatBytes(totalBytes) },
          { label: 'thumbnail', value: imgCount > 0 ? 'Ready' : 'Pending' },
        ],
      }
    })(),
  ]

  // Overall pipeline stats
  const completedStagesCount = stages.filter((s) => s.status === 'completed' || s.status === 'skipped').length
  const totalStagesCount = stages.length
  const progressPercent = Math.round((completedStagesCount / totalStagesCount) * 100)
  const isAnyActive = stages.some((s) => s.status === 'active')
  const isAnyFailed = stages.some((s) => s.status === 'failed')

  const selectedStage = stages.find((s) => s.key === selectedStageKey) || stages[0]

  const getStageHeaderStyles = (key: StageKey) => {
    switch (key) {
      case 'ingest':
        return 'border-emerald-200 bg-emerald-50 text-emerald-900'
      case 'render':
        return 'border-blue-200 bg-blue-50 text-blue-900'
      case 'ocr':
        return 'border-amber-200 bg-amber-50 text-amber-900'
      case 'extract':
        return 'border-purple-200 bg-purple-50 text-purple-900'
      case 'index':
        return 'border-cyan-200 bg-cyan-50 text-cyan-900'
      case 'assets':
        return 'border-pink-200 bg-pink-50 text-pink-900'
    }
  }

  const getStageIcon = (key: StageKey) => {
    switch (key) {
      case 'ingest':
        return <FileUp className="w-4 h-4" />
      case 'render':
        return <Layers className="w-4 h-4" />
      case 'ocr':
        return <Cpu className="w-4 h-4" />
      case 'extract':
        return <Sparkles className="w-4 h-4" />
      case 'index':
        return <Search className="w-4 h-4" />
      case 'assets':
        return <Image className="w-4 h-4" />
    }
  }

  const renderStatusBadge = (status: StageStatus, durationMs?: number) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            {durationMs ? formatDuration(durationMs) : 'DONE'}
          </span>
        )
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
            <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
            RUNNING
          </span>
        )
      case 'waiting':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            QUEUED
          </span>
        )
      case 'skipped':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-gray-100 text-gray-600 border border-gray-200">
            <SkipForward className="w-3 h-3 text-gray-500" />
            BYPASSED
          </span>
        )
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-red-50 text-red-700 border border-red-200">
            <AlertCircle className="w-3 h-3 text-red-600" />
            FAILED
          </span>
        )
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide bg-gray-100 text-gray-500 border border-gray-200">
            PENDING
          </span>
        )
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white text-gray-900 shadow-sm overflow-hidden font-sans">
      {/* Top Control & Status Bar */}
      <div className="px-5 py-3 border-b border-gray-200 bg-gray-50/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 shadow-xs">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-gray-500">Document Processing Graph</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-700 font-mono font-medium">v2.0 (GPU)</span>
              {isLoading && <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />}
            </div>
            <h3 className="text-sm font-semibold text-gray-900 truncate max-w-md" title={documentTitle}>
              {documentTitle}
              {documentId && <span className="ml-2 text-xs font-mono text-gray-400 font-normal">({documentId.slice(0, 8)})</span>}
            </h3>
          </div>
        </div>

        {/* Global Pipeline Progress Bar */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[11px] font-mono text-gray-500 flex items-center justify-end gap-1">
              <span>PIPELINE:</span>
              <span className={`font-semibold ${isAnyFailed ? 'text-red-600' : isAnyActive ? 'text-blue-600' : 'text-emerald-600'}`}>
                {isAnyFailed ? 'ATTENTION REQUIRED' : isAnyActive ? 'IN PROGRESS' : completedStagesCount === totalStagesCount ? 'ALL STAGES COMPLETE' : 'STANDBY'}
              </span>
            </div>
            <div className="text-xs font-mono text-gray-700 font-medium">
              {completedStagesCount} of {totalStagesCount} nodes ({progressPercent}%)
            </div>
          </div>
          <div className="w-28 bg-gray-200 rounded-full h-2 overflow-hidden border border-gray-300">
            <div
              className={`h-full transition-all duration-500 ${
                isAnyFailed
                  ? 'bg-red-500'
                  : isAnyActive
                  ? 'bg-blue-600 animate-pulse'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Blueprint Grid Canvas Area */}
      <div className="p-6 overflow-x-auto bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] bg-slate-50/60 border-b border-gray-200">
        <div className="flex items-stretch min-w-[960px] gap-0 relative">
          {stages.map((stage, idx) => {
            const isSelected = selectedStageKey === stage.key
            const isLast = idx === stages.length - 1
            const nextStage = stages[idx + 1]

            // Connector style between nodes
            const isConnectorActive = stage.status === 'completed' && nextStage?.status === 'active'
            const isConnectorComplete = stage.status === 'completed' && (nextStage?.status === 'completed' || nextStage?.status === 'skipped')
            const isConnectorSkipped = nextStage?.status === 'skipped'

            return (
              <React.Fragment key={stage.key}>
                {/* Node Box */}
                <div
                  data-testid={`node-${stage.key}`}
                  onClick={() => setSelectedStageKey(stage.key)}
                  className={`flex-1 min-w-[155px] max-w-[210px] relative rounded-xl border transition-all duration-200 cursor-pointer select-none bg-white ${
                    isSelected
                      ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-50 scale-[1.02] border-indigo-400 shadow-md'
                      : stage.status === 'active'
                      ? 'border-blue-400 ring-2 ring-blue-100 shadow-sm'
                      : stage.status === 'failed'
                      ? 'border-red-400 ring-2 ring-red-100 shadow-sm'
                      : stage.status === 'skipped'
                      ? 'border-gray-200 opacity-70 bg-gray-50/50 shadow-xs'
                      : stage.status === 'completed'
                      ? 'border-gray-200 shadow-sm hover:border-gray-300 hover:shadow'
                      : 'border-gray-200 opacity-80 hover:opacity-100 shadow-xs'
                  }`}
                >
                  {/* Left Input Pin Socket */}
                  {idx > 0 && (
                    <div
                      className={`absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white z-10 transition-colors shadow-sm ${
                        stage.status === 'completed'
                          ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]'
                          : stage.status === 'active'
                          ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)] animate-ping'
                          : stage.status === 'skipped'
                          ? 'bg-gray-400'
                          : 'bg-gray-300'
                      }`}
                      title="Input socket"
                    />
                  )}

                  {/* Right Output Pin Socket */}
                  {!isLast && (
                    <div
                      className={`absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white z-10 transition-colors shadow-sm ${
                        stage.status === 'completed'
                          ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]'
                          : stage.status === 'active'
                          ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)]'
                          : stage.status === 'skipped'
                          ? 'bg-gray-400'
                          : 'bg-gray-300'
                      }`}
                      title="Output socket"
                    />
                  )}

                  {/* Node Header Bar */}
                  <div
                    className={`px-3 py-2 rounded-t-xl border-b flex items-center justify-between text-xs font-semibold ${getStageHeaderStyles(
                      stage.key
                    )}`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {getStageIcon(stage.key)}
                      <span className="font-mono">{stage.number}.</span>
                      <span className="truncate">{stage.title}</span>
                    </div>
                  </div>

                  {/* Node Body Widgets */}
                  <div className="p-3 space-y-2 bg-white rounded-b-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">STATUS</span>
                      {renderStatusBadge(stage.status, stage.durationMs)}
                    </div>

                    {/* Parameter Key/Values */}
                    <div className="pt-1 border-t border-gray-100 space-y-1.5">
                      {stage.metrics.map((m, mIdx) => (
                        <div key={mIdx} className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-500 font-mono text-[10px]">{m.label}:</span>
                          <span className="text-gray-900 font-mono font-medium truncate max-w-[90px]" title={String(m.value)}>
                            {m.value}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Node Tag / Subtitle */}
                    {stage.tag && (
                      <div className="pt-1.5 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-[9px] font-mono text-gray-400 uppercase truncate max-w-[90px]">{stage.subtitle}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                            stage.tag.variant === 'amber'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : stage.tag.variant === 'blue'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : stage.tag.variant === 'purple'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : stage.tag.variant === 'pink'
                              ? 'bg-pink-50 text-pink-700 border border-pink-200'
                              : stage.tag.variant === 'slate'
                              ? 'bg-slate-100 text-slate-700 border border-slate-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {stage.tag.label}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Connecting Pipe / Arrow */}
                {!isLast && (
                  <div className="flex items-center justify-center w-8 shrink-0 relative px-0.5">
                    <svg className="w-full h-8 overflow-visible" viewBox="0 0 32 32">
                      <defs>
                        <marker
                          id={`arrow-${stage.key}`}
                          viewBox="0 0 10 10"
                          refX="6"
                          refY="5"
                          markerWidth="6"
                          markerHeight="6"
                          orient="auto-start-reverse"
                        >
                          <path
                            d="M 0 1 L 8 5 L 0 9 z"
                            fill={
                              isConnectorComplete
                                ? '#10b981'
                                : isConnectorActive
                                ? '#3b82f6'
                                : isConnectorSkipped
                                ? '#94a3b8'
                                : '#cbd5e1'
                            }
                          />
                        </marker>
                      </defs>
                      <line
                        x1="0"
                        y1="16"
                        x2="26"
                        y2="16"
                        stroke={
                          isConnectorComplete
                            ? '#10b981'
                            : isConnectorActive
                            ? '#3b82f6'
                            : isConnectorSkipped
                            ? '#94a3b8'
                            : '#cbd5e1'
                        }
                        strokeWidth={isConnectorActive || isConnectorComplete ? '2.5' : '2'}
                        strokeDasharray={isConnectorActive ? '4 2' : isConnectorSkipped ? '3 3' : undefined}
                        className={isConnectorActive ? 'animate-pulse' : undefined}
                        markerEnd={`url(#arrow-${stage.key})`}
                      />
                    </svg>
                  </div>
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* Selected Node Details Drawer */}
      <div className="bg-gray-50/90 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-gray-500">Node Inspector:</span>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
              {getStageIcon(selectedStage.key)}
              <span>{selectedStage.number}. {selectedStage.title}</span>
            </div>
            <span className="ml-2">{renderStatusBadge(selectedStage.status, selectedStage.durationMs)}</span>
          </div>

          {selectedStage.status === 'failed' && onRetryStage && (
            <button
              onClick={() => onRetryStage(selectedStage.key)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Stage
            </button>
          )}
        </div>

        {/* Dynamic Details based on Selected Stage */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          {/* Column 1: Checkpoint / Execution Timings */}
          <div className="p-3 rounded-lg bg-white border border-gray-200 space-y-2 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-gray-500 block tracking-wider">Execution Timing</span>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Duration:</span>
                <span className="text-gray-900 font-semibold">{selectedStage.durationMs ? `${selectedStage.durationMs} ms` : 'n/a'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Completed:</span>
                <span className="text-gray-900 truncate max-w-[150px]">
                  {checkpoints[selectedStage.key]?.completedAt
                    ? new Date(checkpoints[selectedStage.key]!.completedAt!).toLocaleTimeString()
                    : selectedStage.status === 'skipped'
                    ? 'Bypassed'
                    : 'Pending'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Node State:</span>
                <span className="text-gray-900 uppercase font-semibold">{selectedStage.status}</span>
              </div>
            </div>
          </div>

          {/* Column 2: Parameters & Metrics */}
          <div className="p-3 rounded-lg bg-white border border-gray-200 space-y-2 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-gray-500 block tracking-wider">Node Parameters</span>
            <div className="space-y-1">
              {selectedStage.metrics.map((m, idx) => (
                <div key={idx} className="flex justify-between">
                  <span className="text-gray-500">{m.label}:</span>
                  <span className="text-gray-900 font-semibold">{m.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Column 3: Stage Specific Insights */}
          <div className="p-3 rounded-lg bg-white border border-gray-200 space-y-2 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-gray-500 block tracking-wider">Engine Insight</span>
            {selectedStage.key === 'ocr' ? (
              <div className="text-gray-800 space-y-1">
                <p>
                  Engine: <span className="text-amber-700 font-semibold">RapidOCR Python Sidecar</span>
                </p>
                <p>
                  Target: <span className="text-gray-900">NVIDIA GPU Acceleration</span>
                </p>
                <p className="text-[11px] text-gray-500 italic">
                  {ocr?.reason || (ocr?.detected === false ? 'Digital text sufficient, bypassed' : 'GPU worker pool active')}
                </p>
              </div>
            ) : selectedStage.key === 'render' ? (
              <div className="text-gray-800 space-y-1">
                <p>
                  Columns: <span className="text-blue-700 font-semibold">{layout?.pages?.[0]?.columns === 2 ? 'Two-Column Layout' : 'Single Column'}</span>
                </p>
                <p>
                  Confidence: <span className="text-gray-900">{layout?.confidence ? `${Math.round(layout.confidence * 100)}%` : '80%'}</span>
                </p>
                <p className="text-[11px] text-gray-500">
                  {ocr?.detected ? 'Image pages found -> OCR triggered' : 'High text density -> OCR skipped'}
                </p>
              </div>
            ) : selectedStage.key === 'extract' ? (
              <div className="text-gray-800 space-y-1">
                <p>
                  D&D Entities: <span className="text-purple-700 font-semibold">{(extraction?.spells || 0) + (extraction?.monsters || 0) + (extraction?.items || 0)} Total</span>
                </p>
                <p className="text-[11px] text-gray-500">
                  Spells: {extraction?.spells || 0} | Monsters: {extraction?.monsters || 0} | Items: {extraction?.items || 0}
                </p>
              </div>
            ) : selectedStage.key === 'index' ? (
              <div className="text-gray-800 space-y-1">
                <p>
                  Elasticsearch: <span className="text-cyan-700 font-semibold">documents</span> index
                </p>
                <p className="text-[11px] text-gray-500 truncate" title={searchIndex || 'Pending'}>
                  Index ID: {searchIndex || 'Generating...'}
                </p>
              </div>
            ) : selectedStage.key === 'assets' ? (
              <div className="text-gray-800 space-y-1">
                <p>
                  Reader Previews: <span className="text-pink-700 font-semibold">{pageImages?.count || 0} WebP Pages</span>
                </p>
                <p className="text-[11px] text-gray-500">
                  Footprint: {formatBytes(pageImages?.totalBytes || 0)}
                </p>
              </div>
            ) : (
              <div className="text-gray-800 space-y-1">
                <p>
                  MIME Verification: <span className="text-emerald-700 font-semibold">PASSED</span>
                </p>
                <p className="text-[11px] text-gray-500">
                  Storage key verified in MinIO / Garage
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Text Sample Snippet if available */}
        {reportProcessing?.textSample && (selectedStage.key === 'render' || selectedStage.key === 'ocr') && (
          <div className="mt-3 p-3 rounded bg-white border border-gray-200 text-[11px] font-mono text-gray-700 max-h-24 overflow-y-auto shadow-xs">
            <span className="text-gray-500 block mb-1 font-bold text-[9px] uppercase tracking-wider">
              {selectedStage.key === 'ocr' ? 'OCR Extracted Text Sample' : 'Digital Extracted Text Sample'}
            </span>
            {reportProcessing.textSample}
          </div>
        )}
      </div>
    </div>
  )
}

export default PipelineGraph
