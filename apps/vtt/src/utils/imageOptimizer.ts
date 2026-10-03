export const MAX_ICON_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const TARGET_ICON_DIMENSION = 256;

export interface OptimizeIconOptions {
  maxDimension?: number;
  maxFileSize?: number;
}

/**
 * Validates and optimizes an icon image file client-side.
 * - Enforces max file size (default 5MB).
 * - Vector SVGs are read directly and converted to clean SVG data URLs.
 * - Raster images (PNG, WebP, JPEG, GIF) are resized and centered to 256x256
 *   PNG data URLs with transparency preserved.
 */
export async function optimizeIconImage(
  file: File,
  options: OptimizeIconOptions = {},
): Promise<string> {
  const maxSize = options.maxFileSize ?? MAX_ICON_FILE_SIZE;
  const targetDim = options.maxDimension ?? TARGET_ICON_DIMENSION;

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
          const canvas = document.createElement('canvas');
          canvas.width = targetDim;
          canvas.height = targetDim;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            // Fallback if 2d canvas context is unavailable
            return resolve(reader.result as string);
          }

          ctx.clearRect(0, 0, targetDim, targetDim);

          const scale = Math.min(targetDim / img.width, targetDim / img.height);
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const x = Math.round((targetDim - w) / 2);
          const y = Math.round((targetDim - h) / 2);

          ctx.drawImage(img, x, y, w, h);
          resolve(canvas.toDataURL('image/png'));
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
