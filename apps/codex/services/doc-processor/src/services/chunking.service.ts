import { createHash } from 'crypto';

export type ChunkSource = 'pdf_extraction' | 'ocr' | 'markdown';

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
}

export const chunkingService = new ChunkingService();
