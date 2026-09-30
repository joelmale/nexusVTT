import { useRef, useState, type PointerEvent } from 'react'
import { BLOCK_STYLES, candidateTag, DEFAULT_PAGE_SIZE, excerpt, scaleBBox } from './overlay'
import type { BBox, CandidateState, LayoutBlock, LayoutBlockClass } from './types'

/**
 * Live Proof canvas, left side: the layout-stage page preview with the page's
 * blocks drawn over it. Block bboxes are normalized (0..1), so they scale onto
 * the preview at any rendered size: the SVG's viewBox is the page size in
 * points and every rect is bbox × page size.
 *
 * Each class has its own stroke pattern and label as well as colour, so the
 * overlay does not rely on colour alone (see OverlayLegend).
 */

export interface PageOverlayProps {
  pageNumber: number
  previewUrl: string | null
  widthPt?: number | null
  heightPt?: number | null
  blocks: LayoutBlock[]
  candidates?: CandidateState[]
  highlight?: BBox[]
  selectedBlockId?: string | null
  onSelectBlock?: (block: LayoutBlock) => void
  /** Gold-set edit mode: the label's region boxes, drawn over the page. */
  goldRegions?: Array<{ class: string; bbox: BBox }>
  selectedGoldRegion?: number | null
  onSelectGoldRegion?: (index: number) => void
  /** Gold-set edit mode: dragging on the page draws a new box (normalized). */
  onDrawBox?: (bbox: BBox) => void
}

const MIN_DRAWN_SIZE = 0.01

export function PageOverlay({
  pageNumber,
  previewUrl,
  widthPt,
  heightPt,
  blocks,
  candidates = [],
  highlight = [],
  selectedBlockId,
  onSelectBlock,
  goldRegions,
  selectedGoldRegion,
  onSelectGoldRegion,
  onDrawBox,
}: PageOverlayProps) {
  const width = widthPt || DEFAULT_PAGE_SIZE.widthPt
  const height = heightPt || DEFAULT_PAGE_SIZE.heightPt
  const labelSize = Math.max(7, width / 60)
  const svgRef = useRef<SVGSVGElement>(null)
  const [drawing, setDrawing] = useState<{ start: [number, number]; end: [number, number] } | null>(null)
  let order = 0

  // Pointer position as a normalized page coordinate (the SVG fills the preview).
  const toNormalized = (event: PointerEvent<SVGSVGElement>): [number, number] => {
    const rect = svgRef.current!.getBoundingClientRect()
    const clamp = (value: number) => Math.min(1, Math.max(0, value))
    return [clamp((event.clientX - rect.left) / (rect.width || 1)), clamp((event.clientY - rect.top) / (rect.height || 1))]
  }
  const drawnBox = (d: NonNullable<typeof drawing>): BBox => [
    Math.min(d.start[0], d.end[0]),
    Math.min(d.start[1], d.end[1]),
    Math.max(d.start[0], d.end[0]),
    Math.max(d.start[1], d.end[1]),
  ]
  const drawHandlers = onDrawBox
    ? {
        onPointerDown: (event: PointerEvent<SVGSVGElement>) => {
          if ((event.target as Element).closest('[data-gold-region]')) return
          const point = toNormalized(event)
          setDrawing({ start: point, end: point })
        },
        onPointerMove: (event: PointerEvent<SVGSVGElement>) => {
          if (drawing) setDrawing({ ...drawing, end: toNormalized(event) })
        },
        onPointerUp: (event: PointerEvent<SVGSVGElement>) => {
          if (!drawing) return
          const box = drawnBox({ ...drawing, end: toNormalized(event) })
          setDrawing(null)
          if (box[2] - box[0] >= MIN_DRAWN_SIZE && box[3] - box[1] >= MIN_DRAWN_SIZE) onDrawBox(box)
        },
      }
    : {}

  return (
    <div
      className="relative w-full overflow-hidden rounded-md border border-gray-300 bg-white dark:border-slate-700 dark:bg-slate-900"
      style={{ aspectRatio: `${width} / ${height}` }}
      data-testid="page-overlay"
    >
      {previewUrl ? (
        <img src={previewUrl} alt={`Page ${pageNumber} preview`} className="absolute inset-0 h-full w-full object-fill" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">No page preview</div>
      )}
      <svg
        ref={svgRef}
        className={`absolute inset-0 h-full w-full ${onDrawBox ? 'cursor-crosshair touch-none' : ''}`}
        viewBox={`0 0 ${width} ${height}`}
        {...drawHandlers}
        role="img"
        aria-label={`Layout of page ${pageNumber}: ${blocks.length} blocks`}
      >
        <defs>
          <pattern id="overlay-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="rgba(148,163,184,0.15)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#94a3b8" strokeWidth="1.5" />
          </pattern>
        </defs>

        {blocks.map((block) => {
          const style = BLOCK_STYLES[block.class] ?? BLOCK_STYLES.body
          const box = scaleBBox(block.bbox, width, height)
          const inText = !style.hatched
          const number = inText ? ++order : null
          const selected = block.id === selectedBlockId
          return (
            <g
              key={block.id}
              data-testid={`block-${block.id}`}
              data-class={block.class}
              onClick={onSelectBlock ? () => onSelectBlock(block) : undefined}
              style={onSelectBlock ? { cursor: 'pointer' } : undefined}
            >
              <rect
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={selected ? 2.5 : 1.2}
                strokeDasharray={style.dash}
              >
                <title>{`${style.label}${number ? ` #${number} in reading order` : ''} (${block.markerType})`}</title>
              </rect>
              {number !== null && (
                <text x={box.x + 2} y={box.y + labelSize} fontSize={labelSize} fontFamily="monospace" fill={style.stroke}>
                  {number}
                </text>
              )}
              {style.hatched && box.width > width * 0.2 && box.height > labelSize * 1.6 && (
                <text x={box.x + 3} y={box.y + labelSize} fontSize={labelSize * 0.85} fontFamily="monospace" fill="#475569">
                  {block.class === 'art' ? 'FILTERED: ART · excluded from text' : 'excluded from text'}
                </text>
              )}
              {block.class === 'sidebar' && (
                <g data-testid={`sidebar-tag-${block.id}`}>
                  <rect x={box.x} y={box.y + box.height} width={Math.min(box.width, labelSize * 22)} height={labelSize * 1.4} fill={style.stroke} />
                  <text x={box.x + 3} y={box.y + box.height + labelSize * 1.05} fontSize={labelSize * 0.9} fontFamily="monospace" fill="#ffffff">
                    {`LORE CALLOUT${block.markdown ? `: "${excerpt(block.markdown)}"` : ''}`}
                  </text>
                </g>
              )}
            </g>
          )
        })}

        {candidates.flatMap((candidate) =>
          candidate.regions
            .filter((region) => region.pageNumber === pageNumber)
            .map((region) => {
              const box = scaleBBox(region.bbox, width, height)
              const style = BLOCK_STYLES.stat_block
              return (
                <g key={`${candidate.key}-${region.pageNumber}`} data-testid={`candidate-${candidate.key}`} data-status={candidate.status}>
                  <rect
                    x={box.x}
                    y={box.y}
                    width={box.width}
                    height={box.height}
                    fill={style.fill}
                    stroke={candidate.status === 'needs_review' ? '#dc2626' : style.stroke}
                    strokeWidth={2}
                    strokeDasharray={style.dash}
                  />
                  <rect x={box.x} y={Math.max(0, box.y - labelSize * 1.4)} width={Math.min(box.width, labelSize * 24)} height={labelSize * 1.4} fill={candidate.status === 'needs_review' ? '#dc2626' : style.stroke} />
                  <text x={box.x + 3} y={Math.max(0, box.y - labelSize * 1.4) + labelSize * 1.05} fontSize={labelSize} fontFamily="monospace" fill="#ffffff">
                    {candidateTag(candidate)}
                  </text>
                  {candidate.status === 'extracting' && (
                    <rect x={box.x} y={box.y} width={box.width} height={box.height} fill="none" stroke="#c084fc" strokeWidth={3} className="motion-safe:animate-pulse" />
                  )}
                </g>
              )
            })
        )}

        {goldRegions?.map((region, index) => {
          const box = scaleBBox(region.bbox, width, height)
          const selected = index === selectedGoldRegion
          return (
            <g
              key={`gold-${index}`}
              data-gold-region={index}
              data-testid={`gold-box-${index}`}
              onClick={onSelectGoldRegion ? () => onSelectGoldRegion(index) : undefined}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                fill={selected ? 'rgba(250,204,21,0.18)' : 'rgba(15,23,42,0.04)'}
                stroke={selected ? '#ca8a04' : '#0f172a'}
                strokeWidth={selected ? 3 : 2}
              />
              <text x={box.x + 3} y={box.y + labelSize} fontSize={labelSize} fontFamily="monospace" fill="#0f172a">
                {`#${index + 1} ${region.class}`}
              </text>
            </g>
          )
        })}

        {drawing && (() => {
          const box = scaleBBox(drawnBox(drawing), width, height)
          return <rect data-testid="drawing-box" x={box.x} y={box.y} width={box.width} height={box.height} fill="none" stroke="#ca8a04" strokeWidth={2} strokeDasharray="4 2" />
        })()}

        {highlight.map((bbox, index) => {
          const box = scaleBBox(bbox, width, height)
          return (
            <rect
              key={`highlight-${index}`}
              data-testid="source-highlight"
              x={box.x - 3}
              y={box.y - 3}
              width={box.width + 6}
              height={box.height + 6}
              fill="none"
              stroke="#facc15"
              strokeWidth={3}
            />
          )
        })}
      </svg>
    </div>
  )
}

const LEGEND_ORDER: LayoutBlockClass[] = ['body', 'table', 'stat_block', 'sidebar', 'art']

export function OverlayLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-600 dark:text-slate-400" aria-label="Overlay legend">
      {LEGEND_ORDER.map((cls) => {
        const style = BLOCK_STYLES[cls]
        return (
          <li key={cls} className="flex items-center gap-1.5">
            <svg width="22" height="12" aria-hidden="true">
              <defs>
                <pattern id={`legend-hatch-${cls}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="4" stroke="#94a3b8" strokeWidth="1.5" />
                </pattern>
              </defs>
              <rect
                x="1"
                y="1"
                width="20"
                height="10"
                fill={style.hatched ? `url(#legend-hatch-${cls})` : style.fill}
                stroke={style.stroke}
                strokeWidth="1.5"
                strokeDasharray={style.dash}
              />
            </svg>
            <span>{cls === 'body' ? 'Text & headings (numbered in reading order)' : style.label}</span>
          </li>
        )
      })}
    </ul>
  )
}
