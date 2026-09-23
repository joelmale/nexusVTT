import { PDFParse } from 'pdf-parse';

class PDFService {
  /**
   * Extract text content from PDF buffer
   */
  async extractText(
    buffer: Buffer,
  ): Promise<{ text: string; pageCount: number }> {
    const parser = new PDFParse({ data: buffer });

    try {
      const data = await parser.getText();

      return {
        text: data.text,
        pageCount: data.total,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to extract text from PDF: ${message}`);
    } finally {
      await parser.destroy();
    }
  }
}

export const pdfService = new PDFService();
