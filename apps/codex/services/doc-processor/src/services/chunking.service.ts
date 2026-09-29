import { createHash } from 'crypto';

export type ChunkSource = 'pdf_extraction' | 'ocr' | 'markdown' | 'layout';

export type DocumentChunkInput = {
  documentId: string;
  chunkIndex: number;
  pageStart?: number;
  pageEnd?: number;
  source: ChunkSource;
  chunkHash: string;
  content: string;
};

const DEFAULT_CHUNK_SIZE = 1500;
const DEFAULT_OVERLAP = 200;

const hashContent = (content: string) =>
  createHash('sha256').update(content).digest('hex');

export class ChunkingService {
  chunkText(params: {
    text: string;
    documentId: string;
    source: ChunkSource;
    pageCount: number;
    chunkSize?: number;
    overlap?: number;
  }): DocumentChunkInput[] {
    const {
      text,
      documentId,
      source,
      pageCount,
      chunkSize = DEFAULT_CHUNK_SIZE,
      overlap = DEFAULT_OVERLAP,
    } = params;

    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (!cleaned) return [];

    const totalLength = cleaned.length;
    const charsPerPage = pageCount > 0 ? totalLength / pageCount : totalLength;
    const chunks: DocumentChunkInput[] = [];

    let index = 0;
    let offset = 0;

    while (offset < cleaned.length) {
      const slice = cleaned.slice(offset, offset + chunkSize);
      const chunkHash = hashContent(slice);

      const startPage = pageCount > 0 ? Math.floor(offset / charsPerPage) + 1 : undefined;
      const endPage = pageCount > 0
        ? Math.min(pageCount, Math.floor((offset + slice.length) / charsPerPage) + 1)
        : undefined;

      chunks.push({
        documentId,
        chunkIndex: index,
        pageStart: startPage,
        pageEnd: endPage,
        source,
        chunkHash,
        content: slice,
      });

      index += 1;
      offset += chunkSize - overlap;
    }

    return chunks;
  }

  /**
   * Page-aware variant of chunkText. Pages are concatenated in page order and
   * chunked with the same window, but each chunk's pageStart/pageEnd come from
   * the actual pages its characters were taken from, not a chars-per-page
   * estimate.
   */
  chunkPages(params: {
    pages: Array<{ pageNumber: number; markdown: string }>;
    documentId: string;
    source: ChunkSource;
    chunkSize?: number;
    overlap?: number;
  }): DocumentChunkInput[] {
    const { documentId, source, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP } = params;

    // spans[i] covers [start, end) of `text`, taken from one page.
    const spans: Array<{ start: number; end: number; pageNumber: number }> = [];
    let text = '';
    for (const page of [...params.pages].sort((a, b) => a.pageNumber - b.pageNumber)) {
      const cleaned = page.markdown.replace(/\s+/g, ' ').trim();
      if (!cleaned) continue;
      if (text) text += ' ';
      spans.push({ start: text.length, end: text.length + cleaned.length, pageNumber: page.pageNumber });
      text += cleaned;
    }
    if (!text) return [];

    // The page a character offset belongs to; separator spaces map to the page before.
    const pageAt = (offset: number) => {
      let found = spans[0].pageNumber;
      for (const span of spans) {
        if (span.start > offset) break;
        found = span.pageNumber;
      }
      return found;
    };

    const step = Math.max(1, chunkSize - overlap);
    const chunks: DocumentChunkInput[] = [];
    for (let offset = 0, index = 0; offset < text.length; offset += step, index += 1) {
      const slice = text.slice(offset, offset + chunkSize);
      chunks.push({
        documentId,
        chunkIndex: index,
        pageStart: pageAt(offset),
        pageEnd: pageAt(offset + slice.length - 1),
        source,
        chunkHash: hashContent(slice),
        content: slice,
      });
    }
    return chunks;
  }
}

export const chunkingService = new ChunkingService();
