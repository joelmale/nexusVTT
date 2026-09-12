import pdfParse from 'pdf-parse';

class PDFService {
  /**
   * Extract text content from PDF buffer
   */
  async extractText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
    try {
      const data = await pdfParse(buffer);

      return {
        text: data.text,
        pageCount: data.numpages,
      };
    } catch (error: any) {
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  }
}

export const pdfService = new PDFService();
