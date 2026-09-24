import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import {
  blobKey,
  derivativeKey,
  DERIVATIVE_MAX_EDGE,
  DERIVATIVE_SPEC_VERSION,
  DERIVATIVE_WEBP_QUALITY,
  renderDerivative,
} from './derivativeSpec';

// The admin API must reuse the ingest pipeline's derivative spec rather than
// invent a parallel one. Guard the duplicated constants against drift.
const ingestScript = path.resolve(__dirname, '../../../../tools/tmt-ingest/derivatives.mjs');

describe('derivative spec parity with tools/tmt-ingest/derivatives.mjs', () => {
  const source = fs.readFileSync(ingestScript, 'utf8');

  it('uses the same spec version', () => {
    expect(source).toContain(`const DERIV_VERSION = '${DERIVATIVE_SPEC_VERSION}';`);
  });

  it('uses the same resize box and WebP quality', () => {
    expect(source).toContain(
      `.resize(${DERIVATIVE_MAX_EDGE}, ${DERIVATIVE_MAX_EDGE}, { fit: 'inside', withoutEnlargement: true })`,
    );
    expect(source).toContain(`.webp({ quality: ${DERIVATIVE_WEBP_QUALITY} })`);
  });

  it('uses the same content-addressed key layout', () => {
    const sha = 'ab'.padEnd(64, '0');
    expect(derivativeKey(sha)).toBe(`derivatives/v1/ab/${sha}.webp`);
    expect(blobKey(sha, '.png')).toBe(`blobs/ab/${sha}.png`);
    expect(source).toContain('`derivatives/${DERIV_VERSION}/${sha256.substring(0, 2)}/${sha256}.webp`');
  });
});

describe('renderDerivative', () => {
  it('bounds the output to the derivative box and strips EXIF metadata', async () => {
    const input = await sharp({
      create: { width: 800, height: 400, channels: 3, background: '#336699' },
    })
      .jpeg()
      .withExif({ IFD0: { Copyright: 'exif-marker', Artist: 'someone' } })
      .toBuffer();
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const rendered = await renderDerivative(input, 10_000_000);
    expect(rendered.width).toBe(256);
    expect(rendered.height).toBe(128);
    const meta = await sharp(rendered.data).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.exif).toBeUndefined();
    expect(rendered.data.includes(Buffer.from('exif-marker'))).toBe(false);
  });

  it('refuses to decode beyond the pixel limit', async () => {
    const input = await sharp({
      create: { width: 300, height: 300, channels: 3, background: '#000' },
    })
      .png()
      .toBuffer();
    await expect(renderDerivative(input, 1000)).rejects.toThrow();
  });
});
