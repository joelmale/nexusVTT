import '../utils/canvas';
import { loadPdfJs } from './layout.service';

// Uses the same pdfjs-dist as the rest of doc-processor. pdf-parse bundles its
// own (older) pdfjs, and two versions in one process share a global worker, so
// whichever ran second failed with 'API version does not match Worker version'.

type TextItem = { str?: string; hasEOL?: boolean };

class PDFService {
  private async open(buffer: Buffer) {
    const pdfjsLib = await loadPdfJs();
    // pdfjs takes ownership of the array it is given, so hand it a copy.
    const task = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
    return { task, pdf: await task.promise };
  }

  /**
   * Extract text content from PDF buffer
   */
  async extractText(
    buffer: Buffer,
  ): Promise<{ text: string; pageCount: number }> {
    try {
      const { task, pdf } = await this.open(buffer);
      try {
        const pages: string[] = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          const page = await pdf.getPage(pageNumber);
          const content = await page.getTextContent();
          const text = (content.items as TextItem[])
            .map((item) => `${item.str ?? ''}${item.hasEOL ? '\n' : ''}`)
            .join('')
            .trim();
          pages.push(text);
        }
        return { text: pages.join('\n\n'), pageCount: pdf.numPages };
      } finally {
        await task.destroy();
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to extract text from PDF: ${message}`);
    }
  }

  /**
   * Page count only, without extracting text.
   */
  async getPageCount(buffer: Buffer): Promise<number> {
    const { task, pdf } = await this.open(buffer);
    try {
      return pdf.numPages;
    } finally {
      await task.destroy();
    }
  }
}

export const pdfService = new PDFService();
