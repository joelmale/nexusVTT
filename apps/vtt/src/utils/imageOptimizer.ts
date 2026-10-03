export const MAX_ICON_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const TARGET_ICON_DIMENSION = 256;
export const DEFAULT_ALPHA_THRESHOLD = 10;
export const DEFAULT_PADDING_RATIO = 0.04; // 4% breathing margin around tightly cropped subject
export const DEFAULT_BG_TOLERANCE = 30;

export interface ContentBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface OptimizeIconOptions {
  maxDimension?: number;
  maxFileSize?: number;
  autoCrop?: boolean;
  paddingRatio?: number;
  alphaThreshold?: number;
  removeBackground?: boolean;
  bgTolerance?: number;
}

/**
 * Scans an ImageData pixel buffer to find the minimum bounding box containing
 * pixels with alpha above alphaThreshold. Returns null if image is empty / fully transparent.
 */
export function findContentBounds(
  imageData: ImageData,
  alphaThreshold: number = DEFAULT_ALPHA_THRESHOLD,
): ContentBounds | null {
  const { width, height, data } = imageData;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x++) {
      const alpha = data[rowOffset + x * 4 + 3];
      if (alpha > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/**
 * Detects uniform solid background starting from image corners/borders and flood-fills
 * connected background pixels, setting their alpha to 0. Preserves internal highlights
 * not contiguous with the outer image border.
 */
export function removeBackgroundFromImageData(
  imageData: ImageData,
  tolerance: number = DEFAULT_BG_TOLERANCE,
): boolean {
  const { width, height, data } = imageData;
  if (width === 0 || height === 0) return false;

  // 1. Sample corners to determine the reference background color
  const cornerCoords: [number, number][] = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];

  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let opaqueCorners = 0;

  for (const [cx, cy] of cornerCoords) {
    const idx = (cy * width + cx) * 4;
    if (data[idx + 3] > 10) {
      rSum += data[idx];
      gSum += data[idx + 1];
      bSum += data[idx + 2];
      opaqueCorners++;
    }
  }

  // If corners are already transparent, background was already removed
  if (opaqueCorners === 0) {
    return false;
  }

  const bgR = rSum / opaqueCorners;
  const bgG = gSum / opaqueCorners;
  const bgB = bSum / opaqueCorners;
  const tolSq = tolerance * tolerance;

  // 2. Flood-fill from borders to clear contiguous background
  const visited = new Uint8Array(width * height);
  const stack: number[] = [];

  const isBgMatch = (i: number): boolean => {
    const o = i * 4;
    // Already transparent counts as background
    if (data[o + 3] <= 10) return true;
    const dr = data[o] - bgR;
    const dg = data[o + 1] - bgG;
    const db = data[o + 2] - bgB;
    return dr * dr + dg * dg + db * db <= tolSq;
  };

  const seed = (x: number, y: number) => {
    const idx = y * width + x;
    if (!visited[idx] && isBgMatch(idx)) {
      visited[idx] = 1;
      stack.push(idx);
    }
  };

  // Seed top and bottom borders
  for (let x = 0; x < width; x++) {
    seed(x, 0);
    seed(x, height - 1);
  }
  // Seed left and right borders
  for (let y = 0; y < height; y++) {
    seed(0, y);
    seed(width - 1, y);
  }

  // Flood fill connected background pixels
  while (stack.length > 0) {
    const curr = stack.pop()!;
    const x = curr % width;
    const y = (curr - x) / width;

    if (x > 0) seed(x - 1, y);
    if (x < width - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < height - 1) seed(x, y + 1);
  }

  let modified = false;
  for (let i = 0; i < width * height; i++) {
    if (visited[i]) {
      const o = i * 4;
      if (data[o + 3] !== 0) {
        data[o + 3] = 0;
        modified = true;
      }
    }
  }

  return modified;
}

/**
 * Core image processing logic that handles background removal and tight content cropping.
 * Renders into a square target canvas and returns a PNG data URL.
 */
export function processCanvasImage(
  img: HTMLImageElement,
  options: OptimizeIconOptions = {},
): string {
  const targetDim = options.maxDimension ?? TARGET_ICON_DIMENSION;
  const autoCrop = options.autoCrop ?? true;
  const paddingRatio = options.paddingRatio ?? DEFAULT_PADDING_RATIO;
  const alphaThreshold = options.alphaThreshold ?? DEFAULT_ALPHA_THRESHOLD;
  const removeBg = options.removeBackground ?? false;
  const bgTolerance = options.bgTolerance ?? DEFAULT_BG_TOLERANCE;

  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = img.width;
  srcCanvas.height = img.height;
  const srcCtx = srcCanvas.getContext('2d');

  const destCanvas = document.createElement('canvas');
  destCanvas.width = targetDim;
  destCanvas.height = targetDim;
  const destCtx = destCanvas.getContext('2d');

  if (!srcCtx || !destCtx) {
    // Fallback if 2d canvas context is unavailable
    return img.src;
  }

  srcCtx.drawImage(img, 0, 0);

  let srcX = 0;
  let srcY = 0;
  let srcW = img.width;
  let srcH = img.height;

  // Perform background removal and content boundary detection if context supports getImageData
  if (typeof srcCtx.getImageData === 'function') {
    const imageData = srcCtx.getImageData(0, 0, img.width, img.height);

    if (removeBg) {
      const modified = removeBackgroundFromImageData(imageData, bgTolerance);
      if (modified && typeof srcCtx.putImageData === 'function') {
        srcCtx.putImageData(imageData, 0, 0);
      }
    }

    if (autoCrop) {
      const bounds = findContentBounds(imageData, alphaThreshold);
      if (bounds) {
        const pad = Math.round(
          Math.max(bounds.width, bounds.height) * paddingRatio,
        );
        srcX = Math.max(0, bounds.minX - pad);
        srcY = Math.max(0, bounds.minY - pad);
        const srcMaxX = Math.min(img.width, bounds.maxX + pad + 1);
        const srcMaxY = Math.min(img.height, bounds.maxY + pad + 1);
        srcW = Math.max(1, srcMaxX - srcX);
        srcH = Math.max(1, srcMaxY - srcY);
      }
    }
  }

  destCtx.clearRect(0, 0, targetDim, targetDim);

  const scale = Math.min(targetDim / srcW, targetDim / srcH);
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);
  const x = Math.round((targetDim - w) / 2);
  const y = Math.round((targetDim - h) / 2);

  destCtx.drawImage(srcCanvas, srcX, srcY, srcW, srcH, x, y, w, h);
  return destCanvas.toDataURL('image/png');
}

/**
 * Optimizes an existing data URL (e.g. from localUserOverrides or imported pack).
 * Re-crops transparent borders tightly or removes solid background.
 */
export async function optimizeIconDataUrl(
  dataUrl: string,
  options: OptimizeIconOptions = {},
): Promise<string> {
  if (dataUrl.startsWith('data:image/svg+xml')) {
    return dataUrl;
  }

  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const result = processCanvasImage(img, options);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      reject(new Error('Failed to decode image data URL.'));
    };
    img.src = dataUrl;
  });
}

/**
 * Validates and optimizes an icon image file client-side.
 * - Enforces max file size (default 5MB).
 * - Vector SVGs are read directly and converted to clean SVG data URLs.
 * - Raster images (PNG, WebP, JPEG, GIF) are:
 *   1. Optionally background-cleared (if removeBackground: true).
 *   2. Auto-cropped tightly to non-transparent content bounds (if autoCrop: true, default).
 *   3. Resized, centered, and padded with a 4% margin to fill 256x256 target canvas.
 */
export async function optimizeIconImage(
  file: File,
  options: OptimizeIconOptions = {},
): Promise<string> {
  const maxSize = options.maxFileSize ?? MAX_ICON_FILE_SIZE;

  if (file.size > maxSize) {
    const mb = Math.round(maxSize / (1024 * 1024));
    throw new Error(`File size exceeds ${mb}MB limit. Please choose a smaller image.`);
  }

  const isSvg =
    file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');

  if (isSvg) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read SVG file content.'));
        }
      };
      reader.onerror = () => {
        reject(reader.error || new Error('Failed to read file.'));
      };
      reader.readAsDataURL(file);
    });
  }

  if (!file.type.startsWith('image/')) {
    throw new Error(
      `Unsupported file type: ${file.type || 'unknown'}. Only image files are supported.`,
    );
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        return reject(new Error('Failed to load image file into memory.'));
      }

      const img = new Image();
      img.onload = () => {
        try {
          const result = processCanvasImage(img, options);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => {
        reject(new Error('Failed to decode image. The file may be corrupted.'));
      };
      img.src = reader.result;
    };
    reader.onerror = () => {
      reject(reader.error || new Error('Failed to read file.'));
    };
    reader.readAsDataURL(file);
  });
}
