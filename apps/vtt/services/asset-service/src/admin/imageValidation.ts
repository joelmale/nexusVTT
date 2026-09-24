import crypto from 'crypto';
import sharp from 'sharp';
import { AdminError } from './errors';

/**
 * Upload validation: the file type is decided by magic bytes, never by the
 * client filename or declared Content-Type. Only raster formats the VTT can
 * render are accepted; SVG (scriptable), GIF and everything else is rejected.
 */
export interface AllowedImageType {
  mime: 'image/png' | 'image/jpeg' | 'image/webp';
  ext: '.png' | '.jpg' | '.webp';
  sharpFormat: 'png' | 'jpeg' | 'webp';
}

const PNG: AllowedImageType = { mime: 'image/png', ext: '.png', sharpFormat: 'png' };
const JPEG: AllowedImageType = { mime: 'image/jpeg', ext: '.jpg', sharpFormat: 'jpeg' };
const WEBP: AllowedImageType = { mime: 'image/webp', ext: '.webp', sharpFormat: 'webp' };

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function sniffImageType(buffer: Buffer): AllowedImageType | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return PNG;
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return JPEG;
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('latin1', 0, 4) === 'RIFF' &&
    buffer.toString('latin1', 8, 12) === 'WEBP'
  ) {
    return WEBP;
  }
  return null;
}

/**
 * Detects bytes appended after the image's own end marker — the usual shape
 * of an image/archive or image/script polyglot. Returns true when trailing
 * data (other than zero padding after a JPEG EOI) is present.
 */
export function hasTrailingData(buffer: Buffer, type: AllowedImageType): boolean {
  if (type === PNG) {
    // Walk the chunk list: length(4) type(4) data(length) crc(4).
    let offset = 8;
    while (offset + 12 <= buffer.length) {
      const length = buffer.readUInt32BE(offset);
      const chunkType = buffer.toString('latin1', offset + 4, offset + 8);
      const next = offset + 12 + length;
      if (next > buffer.length) return false; // truncated: decode will fail
      if (chunkType === 'IEND') return next !== buffer.length;
      offset = next;
    }
    return false;
  }
  if (type === WEBP) {
    const riffSize = buffer.readUInt32LE(4);
    // RIFF payloads are padded to an even length.
    const expected = 8 + riffSize + (riffSize % 2);
    return buffer.length > expected;
  }
  // JPEG: last non-zero bytes must be the EOI marker.
  let end = buffer.length;
  while (end > 0 && buffer[end - 1] === 0x00) end -= 1;
  return !(end >= 2 && buffer[end - 2] === 0xff && buffer[end - 1] === 0xd9);
}

export interface ImageLimits {
  maxUploadBytes: number;
  maxImageDimension: number;
  maxImagePixels: number;
}

export interface ValidatedImage {
  type: AllowedImageType;
  width: number;
  height: number;
  sha256: string;
  size: number;
}

export function sha256Hex(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Validates an upload's bytes up to (but not including) a full decode. The
 * header dimensions are checked before any pixel data is decompressed, which
 * is the decompression-bomb guard; the caller then performs the full decode
 * by rendering the derivative with `limitInputPixels` set to the same limit.
 */
export async function validateImageBuffer(
  buffer: Buffer,
  limits: ImageLimits,
): Promise<ValidatedImage> {
  if (buffer.length === 0) {
    throw new AdminError(400, 'empty-file', 'Uploaded file is empty');
  }
  if (buffer.length > limits.maxUploadBytes) {
    throw new AdminError(413, 'file-too-large', 'Uploaded file exceeds the size limit', {
      maxBytes: limits.maxUploadBytes,
    });
  }

  const type = sniffImageType(buffer);
  if (!type) {
    throw new AdminError(
      415,
      'unsupported-media-type',
      'Only PNG, JPEG and WebP images are accepted',
    );
  }
  if (hasTrailingData(buffer, type)) {
    throw new AdminError(
      415,
      'trailing-data',
      'Image contains data after its end marker and was rejected',
    );
  }

  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;
  try {
    // Header-only read (no pixel decode). The pixel limit is enforced below
    // and again by limitInputPixels during the full decode.
    metadata = await sharp(buffer, { limitInputPixels: false }).metadata();
  } catch {
    throw new AdminError(422, 'image-decode-failed', 'Image header could not be decoded');
  }

  if (metadata.format !== type.sharpFormat) {
    throw new AdminError(
      415,
      'format-mismatch',
      'Image content does not match its detected type',
    );
  }

  const width = metadata.width ?? 0;
  const height = metadata.pageHeight ?? metadata.height ?? 0;
  const frames = Math.max(1, metadata.pages ?? 1);
  if (width <= 0 || height <= 0) {
    throw new AdminError(422, 'image-decode-failed', 'Image has no usable dimensions');
  }
  if (
    width > limits.maxImageDimension ||
    height > limits.maxImageDimension ||
    width * height * frames > limits.maxImagePixels
  ) {
    throw new AdminError(422, 'image-too-large', 'Image dimensions exceed the limit', {
      width,
      height,
      maxDimension: limits.maxImageDimension,
      maxPixels: limits.maxImagePixels,
    });
  }

  return { type, width, height, sha256: sha256Hex(buffer), size: buffer.length };
}
