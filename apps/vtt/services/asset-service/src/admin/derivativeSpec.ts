import sharp from 'sharp';

/**
 * The library derivative spec, shared with the ingest pipeline in
 * `apps/vtt/tools/tmt-ingest/derivatives.mjs` (ADR-0011 content-addressed
 * layout). The admin API reuses that pipeline's layout and output format so
 * admin-uploaded and TMT-ingested assets are indistinguishable on disk.
 *
 * `derivativeSpec.test.ts` asserts these constants still match the ingest
 * script; change both together and bump the spec version when the output
 * format changes.
 */
export const DERIVATIVE_SPEC_VERSION = 'v1';
export const DERIVATIVE_MAX_EDGE = 256;
export const DERIVATIVE_WEBP_QUALITY = 80;

/** `blobs/<sha256[0:2]>/<sha256><ext>` — the original, byte for byte. */
export function blobKey(sha256: string, ext: string): string {
  return `blobs/${sha256.substring(0, 2)}/${sha256}${ext}`;
}

/** `derivatives/v<spec>/<sha256[0:2]>/<sha256>.webp` — the served thumbnail. */
export function derivativeKey(sha256: string): string {
  return `derivatives/${DERIVATIVE_SPEC_VERSION}/${sha256.substring(0, 2)}/${sha256}.webp`;
}

export interface RenderedDerivative {
  data: Buffer;
  width: number;
  height: number;
}

/**
 * Renders the thumbnail derivative. This is also the full-decode validation
 * step for uploads: `limitInputPixels` bounds the decoded size. sharp writes
 * no input metadata unless `withMetadata()` is requested, so EXIF, XMP, ICC
 * comments and GPS tags are stripped from every stored derivative.
 */
export async function renderDerivative(
  input: Buffer,
  maxInputPixels: number,
): Promise<RenderedDerivative> {
  const { data, info } = await sharp(input, { limitInputPixels: maxInputPixels })
    .resize(DERIVATIVE_MAX_EDGE, DERIVATIVE_MAX_EDGE, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: DERIVATIVE_WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
