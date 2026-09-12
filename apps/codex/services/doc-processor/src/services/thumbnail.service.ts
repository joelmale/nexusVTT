import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '../utils/canvas';
import sharp from 'sharp';
import { env } from '../config/env';

// Configure PDF.js worker
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');

class ThumbnailService {
  /**
   * Generate thumbnail from first page of PDF
   */
  async generateThumbnail(pdfBuffer: Buffer): Promise<Buffer> {
    try {
      // Load PDF document
      // Convert Buffer to Uint8Array for Node.js 22 compatibility
      const uint8Array = new Uint8Array(pdfBuffer);
      const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
      const pdfDocument = await loadingTask.promise;

      // Get first page
      const page = await pdfDocument.getPage(1);

      // Calculate scale to achieve desired thumbnail width
      const viewport = page.getViewport({ scale: 1.0 });
      const scale = env.THUMBNAIL_WIDTH / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      // Create canvas
      const canvas = createCanvas(scaledViewport.width, scaledViewport.height);
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Canvas 2d context unavailable');
      }

      // Render PDF page to canvas
      // @ts-ignore
      await page.render({
        canvasContext: context as any,
        viewport: scaledViewport,
      }).promise;

      // Convert canvas to buffer
      const pngBuffer = canvas.toBuffer('image/png');

      // Compress to JPEG using sharp
      const jpegBuffer = await sharp(pngBuffer)
        .jpeg({ quality: env.THUMBNAIL_QUALITY })
        .toBuffer();

      // Cleanup
      await pdfDocument.destroy();

      return jpegBuffer;
    } catch (error: any) {
      throw new Error(`Failed to generate thumbnail: ${error.message}`);
    }
  }
}

export const thumbnailService = new ThumbnailService();
