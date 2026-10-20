import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfjs = vi.hoisted(() => ({
  getDocument: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock('../layout.service', () => ({
  loadPdfJs: vi.fn(async () => ({ getDocument: pdfjs.getDocument })),
}));

import { pdfService } from '../pdf.service';

const fakePdf = (pages: Array<Array<{ str: string; hasEOL?: boolean }>>) => ({
  numPages: pages.length,
  getPage: vi.fn(async (n: number) => ({ getTextContent: async () => ({ items: pages[n - 1] }) })),
});

/** What pdfjs getDocument returns: a loading task owning the document. */
const task = (pdf: Promise<unknown>) => ({ promise: pdf, destroy: pdfjs.destroy });

describe('PDFService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pdfjs.destroy.mockResolvedValue(undefined);
  });

  it('extracts text per page and the page count through the shared pdfjs', async () => {
    const buffer = Buffer.from('pdf contents');
    pdfjs.getDocument.mockReturnValue(
      task(
        Promise.resolve(
          fakePdf([
            [{ str: 'Extracted ' }, { str: 'text', hasEOL: true }, { str: 'more' }],
            [{ str: 'Page two' }],
          ]),
        ),
      ),
    );

    await expect(pdfService.extractText(buffer)).resolves.toEqual({
      text: 'Extracted text\nmore\n\nPage two',
      pageCount: 2,
    });

    const { data } = pdfjs.getDocument.mock.calls[0][0];
    expect(data).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(data).equals(buffer)).toBe(true);
    expect(pdfjs.destroy).toHaveBeenCalledTimes(1);
  });

  it('destroys the document and wraps extraction errors', async () => {
    const pdf = fakePdf([[{ str: 'x' }]]);
    pdf.getPage.mockRejectedValue(new Error('bad page'));
    pdfjs.getDocument.mockReturnValue(task(Promise.resolve(pdf)));

    await expect(pdfService.extractText(Buffer.from('x'))).rejects.toThrow('Failed to extract text from PDF: bad page');
    expect(pdfjs.destroy).toHaveBeenCalledTimes(1);
  });

  it('wraps a failure to open the PDF', async () => {
    pdfjs.getDocument.mockReturnValue(task(Promise.reject(new Error('invalid PDF'))));
    await expect(pdfService.extractText(Buffer.from('invalid'))).rejects.toThrow('Failed to extract text from PDF: invalid PDF');
  });

  it('returns the page count without reading text and destroys the document', async () => {
    const pdf = fakePdf([[], [], []]);
    pdfjs.getDocument.mockReturnValue(task(Promise.resolve(pdf)));

    await expect(pdfService.getPageCount(Buffer.from('x'))).resolves.toBe(3);
    expect(pdf.getPage).not.toHaveBeenCalled();
    expect(pdfjs.destroy).toHaveBeenCalledTimes(1);
  });
});
