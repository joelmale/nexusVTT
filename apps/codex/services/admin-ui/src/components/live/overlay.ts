import type { BBox, CandidateState, LayoutBlockClass } from './types'

// Overlay geometry and styles for PageOverlay (kept out of the component file for fast refresh).

export const DEFAULT_PAGE_SIZE = { widthPt: 612, heightPt: 792 } // US Letter

type Style = { stroke: string; fill: string; dash?: string; label: string; hatched?: boolean }

export const BLOCK_STYLES: Record<LayoutBlockClass, Style> = {
  body: { stroke: '#059669', fill: 'rgba(16,185,129,0.08)', label: 'Text' },
  heading: { stroke: '#059669', fill: 'rgba(16,185,129,0.14)', label: 'Heading' },
  table: { stroke: '#2563eb', fill: 'rgba(37,99,235,0.08)', dash: '10 4', label: 'Table' },
  stat_block: { stroke: '#9333ea', fill: 'rgba(168,85,247,0.12)', dash: '6 3', label: 'Stat block' },
  sidebar: { stroke: '#ea580c', fill: 'rgba(249,115,22,0.10)', dash: '2 3', label: 'Sidebar (heuristic)' },
  art: { stroke: '#64748b', fill: 'url(#overlay-hatch)', label: 'Art · excluded from text', hatched: true },
  furniture: { stroke: '#64748b', fill: 'url(#overlay-hatch)', label: 'Header/footer · excluded from text', hatched: true },
}

export const CANDIDATE_STATUS_LABEL: Record<CandidateState['status'], string> = {
  extracting: 'extracting…',
  extracted: 'extracted',
  needs_review: 'needs review',
  rejected: 'no entity',
}

export const scaleBBox = (bbox: BBox, widthPt: number, heightPt: number) => ({
  x: bbox[0] * widthPt,
  y: bbox[1] * heightPt,
  width: Math.max(0, (bbox[2] - bbox[0]) * widthPt),
  height: Math.max(0, (bbox[3] - bbox[1]) * heightPt),
})
