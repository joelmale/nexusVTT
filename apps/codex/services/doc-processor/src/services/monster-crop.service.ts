import sharp from 'sharp';
import { env } from '../config/env';
import { pageImageService } from './page-image.service';
import { CandidateRegion } from '../extraction/candidates';

const MARGIN = 0.015; // normalized margin added around each region

/**
 * Renders the pages that hold monster candidates once, at EXTRACT_CROP_DPI
 * (~200), and crops each region (bbox + margin) to a PNG for the VLM. A stat
 * block spanning a column or page break yields one crop per region.
 */
export class MonsterCropService {
  async cropRegions(pdfBuffer: Buffer, regionsByKey: Map<string, CandidateRegion[]>): Promise<Map<string, Buffer[]>> {
    const pages = [...new Set([...regionsByKey.values()].flat().map((r) => r.pageNumber))].sort((a, b) => a - b);
    const crops = new Map<string, Buffer[]>();
    if (pages.length === 0) return crops;

    const rendered = new Map<number, Buffer>();
    await pageImageService.renderOcrImages(pdfBuffer, {
      targetPages: pages,
      dpi: env.EXTRACT_CROP_DPI,
      onPage: async (page) => {
        rendered.set(page.pageNumber, page.buffer);
      },
    });

    for (const [key, regions] of regionsByKey) {
      const images: Buffer[] = [];
      for (const region of regions) {
        const page = rendered.get(region.pageNumber);
        if (page) images.push(await cropRegion(page, region.bbox));
      }
      crops.set(key, images);
    }
    return crops;
  }
}

export const cropRegion = async (pagePng: Buffer, bbox: [number, number, number, number]): Promise<Buffer> => {
  const image = sharp(pagePng);
  const { width = 0, height = 0 } = await image.metadata();
  const x0 = Math.max(0, bbox[0] - MARGIN);
  const y0 = Math.max(0, bbox[1] - MARGIN);
  const x1 = Math.min(1, bbox[2] + MARGIN);
  const y1 = Math.min(1, bbox[3] + MARGIN);
  // Round each edge to pixels once; (x1 - x0) * width drifts by a pixel in floating point.
  const left = Math.floor(x0 * width);
  const top = Math.floor(y0 * height);
  const right = Math.min(width, Math.round(x1 * width));
  const bottom = Math.min(height, Math.round(y1 * height));
  return image
    .extract({
      left,
      top,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top),
    })
    .png()
    .toBuffer();
};

export const monsterCropService = new MonsterCropService();
