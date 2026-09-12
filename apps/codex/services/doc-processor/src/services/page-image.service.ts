import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '../utils/canvas';
import sharp from 'sharp';
import { env } from '../config/env';

// Configure PDF.js worker
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');

export interface RenderedPageImage {
  pageNumber: number;
  buffer: Buffer;
  ocrBuffer?: Buffer;
}

interface PageImageRenderProgress {
  pageNumber: number;
  totalPages: number;
  maxPages: number;
}

export interface RenderedOcrPage {
  pageNumber: number;
  buffer: Buffer;
}

class PageImageService {
  /**
   * Render PDF pages to WebP buffers for reader consumption
   */
  async renderPageImages(
    pdfBuffer: Buffer,
    options: { includeOcrBuffer?: boolean; onProgress?: (progress: PageImageRenderProgress) => void } = {}
  ): Promise<RenderedPageImage[]> {
    const images: RenderedPageImage[] = [];

    // Convert Buffer to Uint8Array for PDF.js
    const uint8Array = new Uint8Array(pdfBuffer);
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdfDocument = await loadingTask.promise;

    const totalPages = pdfDocument.numPages;
    const maxPages = Math.min(env.PAGE_IMAGE_MAX_PAGES, totalPages);

    try {
      for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
        const page = await pdfDocument.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.0 });
        const scale = env.PAGE_IMAGE_WIDTH / viewport.width;
        const scaledViewport = page.getViewport({ scale });

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

        // Convert to WebP buffer
        const pngBuffer = canvas.toBuffer('image/png');
        const webpBuffer = await sharp(pngBuffer)
          .webp({ quality: env.PAGE_IMAGE_QUALITY })
          .toBuffer();

        images.push({
          pageNumber,
          buffer: webpBuffer,
          ocrBuffer: options.includeOcrBuffer ? pngBuffer : undefined,
        });

        if (options.onProgress) {
          options.onProgress({
            pageNumber,
            totalPages,
            maxPages,
          });
        }
      }

      return images;
    } finally {
      await pdfDocument.destroy();
    }
  }

  /**
   * Render PDF pages to PNG buffers for OCR
   */
  async renderOcrImages(
    pdfBuffer: Buffer,
    options: { onProgress?: (progress: PageImageRenderProgress) => void } = {}
  ): Promise<RenderedOcrPage[]> {
    const images: RenderedOcrPage[] = [];

    const uint8Array = new Uint8Array(pdfBuffer);
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdfDocument = await loadingTask.promise;

    const totalPages = pdfDocument.numPages;
    const maxPages = Math.min(env.OCR_MAX_PAGES, totalPages);

    try {
      for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
        const page = await pdfDocument.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.0 });
        const scale = env.PAGE_IMAGE_WIDTH / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        const canvas = createCanvas(scaledViewport.width, scaledViewport.height);
        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('Canvas 2d context unavailable');
        }

        // @ts-ignore
        await page.render({
          canvasContext: context as any,
          viewport: scaledViewport,
        }).promise;

        const pngBuffer = canvas.toBuffer('image/png');
        images.push({ pageNumber, buffer: pngBuffer });

        if (options.onProgress) {
          options.onProgress({ pageNumber, totalPages, maxPages });
        }
      }

      return images;
    } finally {
      await pdfDocument.destroy();
    }
  }
}

export const pageImageService = new PageImageService();
