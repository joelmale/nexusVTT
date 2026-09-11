/**
 * Image processing utilities for token management
 * Based on Ogres VTT approach: client-side processing, hashing, thumbnail generation
 */

export interface ProcessedImage {
  hash: string;
  blob: Blob;
  width: number;
  height: number;
  thumbnailHash: string;
  thumbnailBlob: Blob;
  filename: string;
  size: number;
}

/**
 * Generate SHA-1 hash of a Blob
 */
export async function generateHash(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-1', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hashHex;
}

/**
 * Create a thumbnail from an image bitmap
 */
async function createThumbnail(
  imageBitmap: ImageBitmap,
  maxSize: number = 256,
): Promise<{ blob: Blob; width: number; height: number }> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // Calculate thumbnail dimensions maintaining aspect ratio
  let width = imageBitmap.width;
  let height = imageBitmap.height;

  if (width > maxSize || height > maxSize) {
    if (width > height) {
      height = Math.round((height * maxSize) / width);
      width = maxSize;
    } else {
      width = Math.round((width * maxSize) / height);
      height = maxSize;
    }
  }

  canvas.width = width;
  canvas.height = height;

  // Draw the image onto the canvas
  ctx.drawImage(imageBitmap, 0, 0, width, height);

  // Convert to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve({ blob, width, height });
        } else {
          reject(new Error('Failed to create thumbnail blob'));
        }
      },
      'image/jpeg',
      0.85,
    );
  });
}

/**
 * Process an uploaded image file
 * - Creates ImageBitmap
 * - Generates full-size blob with hash
 * - Creates thumbnail with hash
 * - Returns all metadata
 */
export async function processImageFile(file: File): Promise<ProcessedImage> {
  // Validate file type
  if (!file.type.startsWith('image/')) {
    throw new Error(
      `Invalid file type: ${file.type}. Only images are supported.`,
    );
  }

  // Validate file size (max 10MB)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error(
      `File size ${Math.round(file.size / 1024 / 1024)}MB exceeds maximum ${Math.round(maxSize / 1024 / 1024)}MB`,
    );
  }

  // Create ImageBitmap from file
  const imageBitmap = await createImageBitmap(file);

  // Create canvas for full-size image
  const canvas = document.createElement('canvas');
  canvas.width = imageBitmap.width;
  canvas.height = imageBitmap.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(imageBitmap, 0, 0);

  // Convert to blob (JPEG with good quality)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error('Failed to create blob'));
        }
      },
      'image/jpeg',
      0.92,
    );
  });

  // Generate hash for full-size image
  const hash = await generateHash(blob);

  // Create thumbnail
  const thumbnail = await createThumbnail(imageBitmap, 256);
  const thumbnailHash = await generateHash(thumbnail.blob);

  // Clean up
  imageBitmap.close();

  return {
    hash,
    blob,
    width: canvas.width,
    height: canvas.height,
    thumbnailHash,
    thumbnailBlob: thumbnail.blob,
    filename: file.name,
    size: blob.size,
  };
}

/**
 * Process multiple image files
 */
export async function processImageFiles(
  files: File[],
  onProgress?: (current: number, total: number, filename: string) => void,
): Promise<ProcessedImage[]> {
  const results: ProcessedImage[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (onProgress) {
      onProgress(i + 1, files.length, file.name);
    }

    try {
      const processed = await processImageFile(file);
      results.push(processed);
    } catch (error) {
      console.error(`Failed to process ${file.name}:`, error);
      throw error;
    }
  }

  return results;
}

/**
 * Load an image from a blob URL
 */
export function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Convert a base64 data URL to a Blob
 */
export function dataURLToBlob(dataURL: string): Blob {
  const parts = dataURL.split(',');
  const contentType = parts[0].split(':')[1].split(';')[0];
  const base64 = atob(parts[1]);
  const arrayBuffer = new ArrayBuffer(base64.length);
  const uint8Array = new Uint8Array(arrayBuffer);

  for (let i = 0; i < base64.length; i++) {
    uint8Array[i] = base64.charCodeAt(i);
  }

  return new Blob([uint8Array], { type: contentType });
}

/**
 * Convert a Blob to a base64 data URL
 */
export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
