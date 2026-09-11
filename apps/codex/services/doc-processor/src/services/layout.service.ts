import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');

type PDFTextItem = {
  str: string;
  transform?: number[];
};

type LineGroup = {
  y: number;
  x: number;
  text: string;
};

export type LayoutPageResult = {
  pageNumber: number;
  text: string;
  columns: number;
  confidence: number;
};

export type LayoutExtractionResult = {
  text: string;
  pageCount: number;
  pages: LayoutPageResult[];
};

const LINE_Y_THRESHOLD = 4;

export const detectColumns = (items: PDFTextItem[], pageWidth: number) => {
  if (pageWidth <= 0) return 1;
  const leftBoundary = pageWidth * 0.45;
  const rightBoundary = pageWidth * 0.55;

  let leftCount = 0;
  let rightCount = 0;
  let total = 0;

  for (const item of items) {
    if (!item.transform) continue;
    const x = item.transform[4];
    total += 1;
    if (x < leftBoundary) leftCount += 1;
    if (x > rightBoundary) rightCount += 1;
  }

  if (total < 20) return 1;
  if (leftCount > 10 && rightCount > 10) return 2;
  return 1;
};

export const groupLines = (items: PDFTextItem[]) => {
  const lines: LineGroup[] = [];

  for (const item of items) {
    if (!item.transform) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    const text = item.str?.trim();
    if (!text) continue;

    const existing = lines.find((line) => Math.abs(line.y - y) <= LINE_Y_THRESHOLD);
    if (existing) {
      existing.text = `${existing.text} ${text}`.trim();
      existing.x = Math.min(existing.x, x);
      continue;
    }

    lines.push({ y, x, text });
  }

  return lines;
};

const sortLinesTopDown = (lines: LineGroup[]) =>
  lines.sort((a, b) => b.y - a.y || a.x - b.x);

export class LayoutService {
  async extractTextWithLayout(buffer: Buffer): Promise<LayoutExtractionResult> {
    const uint8Array = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdfDocument = await loadingTask.promise;

    const pageCount = pdfDocument.numPages;
    const pages: LayoutPageResult[] = [];
    const pageTexts: string[] = [];

    try {
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
        const page = await pdfDocument.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.0 });
        const textContent = await page.getTextContent();
        const items = textContent.items as PDFTextItem[];

        const columns = detectColumns(items, viewport.width);
        const lines = groupLines(items);
        const sorted = sortLinesTopDown(lines);

        let orderedLines: LineGroup[] = sorted;
        if (columns === 2) {
          const midpoint = viewport.width / 2;
          const left = sorted.filter((line) => line.x < midpoint);
          const right = sorted.filter((line) => line.x >= midpoint);
          orderedLines = [...sortLinesTopDown(left), ...sortLinesTopDown(right)];
        }

        const text = orderedLines.map((line) => line.text).join('\n');
        const confidence = columns === 2 ? 0.7 : 0.5;

        pages.push({
          pageNumber,
          text,
          columns,
          confidence,
        });
        pageTexts.push(text);
      }

      return {
        text: pageTexts.join('\n\n'),
        pageCount,
        pages,
      };
    } finally {
      await pdfDocument.destroy();
    }
  }
}

export const layoutService = new LayoutService();
