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
