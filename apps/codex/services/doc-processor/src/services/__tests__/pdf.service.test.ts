import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfParseMocks = vi.hoisted(() => ({
  constructor: vi.fn(),
  destroy: vi.fn(),
  getText: vi.fn(),
}));

vi.mock('pdf-parse', () => ({
  PDFParse: class {
    constructor(options: unknown) {
      pdfParseMocks.constructor(options);
    }

    destroy = pdfParseMocks.destroy;
    getText = pdfParseMocks.getText;
  },
}));

import { pdfService } from '../pdf.service';

describe('PDFService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pdfParseMocks.destroy.mockResolvedValue(undefined);
  });

  it('extracts text and the page count with the pdf-parse v2 API', async () => {
    const buffer = Buffer.from('pdf contents');
    pdfParseMocks.getText.mockResolvedValue({
      text: 'Extracted text',
      total: 3,
    });

    await expect(pdfService.extractText(buffer)).resolves.toEqual({
      text: 'Extracted text',
      pageCount: 3,
    });

    expect(pdfParseMocks.constructor).toHaveBeenCalledWith({ data: buffer });
    expect(pdfParseMocks.destroy).toHaveBeenCalledTimes(1);
  });

  it('destroys the parser and wraps extraction errors', async () => {
    pdfParseMocks.getText.mockRejectedValue(new Error('invalid PDF'));

    await expect(
      pdfService.extractText(Buffer.from('invalid')),
    ).rejects.toThrow('Failed to extract text from PDF: invalid PDF');
    expect(pdfParseMocks.destroy).toHaveBeenCalledTimes(1);
  });
});
