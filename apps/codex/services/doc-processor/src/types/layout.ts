// Ingestion v2 page model types (apps/docs/codex/ingestion-pipeline-v2-plan.md#page-model).
// Mirrors the JSON stored in DocumentPage.blocks / DocumentPage.quality and the
// ocr-service POST /layout/s3 response.

export type LayoutBlockClass =
  | 'body' // text, section headers, lists
  | 'heading'
  | 'table'
  | 'stat_block' // candidate from detection, not a Marker-native class
  | 'sidebar' // heuristic
  | 'art' // pictures and figures, excluded from text
  | 'furniture'; // page headers, footers and page numbers, excluded

export type LayoutBlock = {
  id: string; // stable within the page, e.g. "p12-b7"
  class: LayoutBlockClass;
  markerType: string; // raw Marker block_type, kept for debugging
  bbox: [number, number, number, number]; // normalized 0..1 (x0, y0, x1, y1)
  markdown?: string; // omitted for art and furniture
};

export type PageQuality = {
  wordValidity?: number; // 0..1, headline "text cleanliness"
  symbolNoise?: number; // 0..1
  repetition?: number; // longest repeated n-gram run
  textSource?: { embedded: number; ocr: number }; // shares, 0..1
  wordCount?: number;
};

export type LayoutPage = {
  pageNumber: number; // 1-based
  markdown: string;
  blocks: LayoutBlock[];
  widthPt?: number | null;
  heightPt?: number | null;
  previewKey?: string | null;
  quality?: PageQuality;
};

export type LayoutBatchResponse = {
  engine: string; // e.g. "marker@1.x.y"
  pageCount?: number;
  pages: LayoutPage[];
};
