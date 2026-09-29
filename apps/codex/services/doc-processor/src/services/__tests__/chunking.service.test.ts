import { chunkingService } from '../chunking.service';

describe('chunkingService', () => {
  test('creates chunks with page ranges', () => {
    const text = 'A'.repeat(2000);
    const chunks = chunkingService.chunkText({
      text,
      documentId: 'doc-1',
      source: 'pdf_extraction',
      pageCount: 2,
      chunkSize: 1000,
      overlap: 0,
    });

    expect(chunks.length).toBe(2);
    expect(chunks[0].pageStart).toBe(1);
    expect(chunks[1].pageEnd).toBe(2);
  });
});

describe('chunkingService.chunkPages', () => {
  const page = (pageNumber: number, length: number, char = 'x') => ({ pageNumber, markdown: char.repeat(length) });

  test('pageStart/pageEnd are the exact pages a chunk spans', () => {
    // Uneven pages: an estimate from chars-per-page would put chunk 2 on page 2.
    const pages = [page(1, 100, 'a'), page(2, 900, 'b'), page(3, 100, 'c')];
    const chunks = chunkingService.chunkPages({ pages, documentId: 'doc-1', source: 'layout', chunkSize: 500, overlap: 0 });

    // text = a*100 + ' ' + b*900 + ' ' + c*100 (1102 chars)
    expect(chunks.map((c) => [c.pageStart, c.pageEnd])).toEqual([
      [1, 2],
      [2, 2],
      [2, 3],
    ]);
    expect(chunks.every((c) => c.source === 'layout')).toBe(true);
  });

  test('chunks inside one page start and end on that page', () => {
    const chunks = chunkingService.chunkPages({
      pages: [page(4, 300), page(5, 300)],
      documentId: 'doc-1',
      source: 'layout',
      chunkSize: 100,
      overlap: 0,
    });
    expect(chunks[0]).toMatchObject({ pageStart: 4, pageEnd: 4 });
    expect(chunks[chunks.length - 1]).toMatchObject({ pageStart: 5, pageEnd: 5 });
  });

  test('orders pages, skips empty ones, and returns [] for no text', () => {
    const chunks = chunkingService.chunkPages({
      pages: [{ pageNumber: 3, markdown: 'third' }, { pageNumber: 2, markdown: '   ' }, { pageNumber: 1, markdown: 'first' }],
      documentId: 'doc-1',
      source: 'layout',
    });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ content: 'first third', pageStart: 1, pageEnd: 3 });
    expect(chunkingService.chunkPages({ pages: [], documentId: 'd', source: 'layout' })).toEqual([]);
  });
});
