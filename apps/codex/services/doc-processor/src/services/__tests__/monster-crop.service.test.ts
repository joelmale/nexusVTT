import sharp from 'sharp';
import { cropRegion, cropRegionWithGeometry } from '../monster-crop.service';

describe('cropRegion', () => {
  it('crops a normalized bbox plus margin from the rendered page', async () => {
    const page = await sharp({ create: { width: 1000, height: 2000, channels: 3, background: 'white' } }).png().toBuffer();
    const crop = await cropRegion(page, [0.5, 0.25, 0.9, 0.5]);
    const { width, height } = await sharp(crop).metadata();
    // 0.4 x 0.25 of the page, plus a 0.015 margin on each side.
    expect(width).toBe(430);
    expect(height).toBe(560);
  });

  it('clamps the margin at the page edge', async () => {
    const page = await sharp({ create: { width: 800, height: 800, channels: 3, background: 'white' } }).png().toBuffer();
    const { width, height } = await sharp(await cropRegion(page, [0, 0, 1, 1])).metadata();
    expect([width, height]).toEqual([800, 800]);
  });

  it('downscales oversized crops to prevent token context explosion in the VLM', async () => {
    // Large 3000x4000 page
    const page = await sharp({ create: { width: 3000, height: 4000, channels: 3, background: 'white' } }).png().toBuffer();
    const result = await cropRegionWithGeometry(page, [0, 0, 1, 1]);
    const { width, height } = await sharp(result.buffer).metadata();

    // Box geometry reports original crop coordinates for display / logging
    expect(result.width).toBe(3000);
    expect(result.height).toBe(4000);

    // Buffer is downscaled to fit inside 1200x1600 (aspect ratio 3:4 -> 1200x1600)
    expect(width).toBeLessThanOrEqual(1200);
    expect(height).toBeLessThanOrEqual(1600);
    expect(width).toBe(1200);
    expect(height).toBe(1600);
  });
});
