import { useState, useCallback } from 'react';
import { processImageFile, processImageFiles } from '@/utils/imageProcessor';
import { tokenImageStorage } from '@/services/tokenImageStorage';

interface UploadProgress {
  current: number;
  total: number;
  filename: string;
  percentage: number;
}

interface UseImageUploaderReturn {
  isUploading: boolean;
  progress: UploadProgress | null;
  error: string | null;
  uploadImage: (file: File) => Promise<string>; // Returns checksum
  uploadImages: (files: File[]) => Promise<string[]>; // Returns checksums
  clearError: () => void;
}

/**
 * Hook for uploading and processing token images
 * Based on Ogres VTT approach: client-side processing with IndexedDB storage
 */
export const useImageUploader = (): UseImageUploaderReturn => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Upload a single image
   */
  const uploadImage = useCallback(async (file: File): Promise<string> => {
    setIsUploading(true);
    setError(null);
    setProgress({ current: 1, total: 1, filename: file.name, percentage: 0 });

    try {
      // Initialize storage if needed
      if (!tokenImageStorage['db']) {
        await tokenImageStorage.initialize();
      }

      // Process the image
      const processed = await processImageFile(file);

      // Check if image already exists
      const exists = await tokenImageStorage.hasImage(processed.hash);
      if (exists) {
        console.log(
          `ℹ️ Image already exists: ${file.name} (${processed.hash.substring(0, 8)}...)`,
        );
        setProgress({
          current: 1,
          total: 1,
          filename: file.name,
          percentage: 100,
        });
        return processed.hash;
      }

      // Store in IndexedDB
      await tokenImageStorage.storeImage(
        processed.hash,
        processed.blob,
        processed.width,
        processed.height,
        processed.thumbnailHash,
        processed.thumbnailBlob,
        processed.filename,
      );

      setProgress({
        current: 1,
        total: 1,
        filename: file.name,
        percentage: 100,
      });
      return processed.hash;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to upload image';
      setError(errorMessage);
      console.error('Image upload failed:', err);
      throw err;
    } finally {
      setIsUploading(false);
      setTimeout(() => setProgress(null), 2000);
    }
  }, []);

  /**
   * Upload multiple images
   */
  const uploadImages = useCallback(async (files: File[]): Promise<string[]> => {
    if (files.length === 0) {
      return [];
    }

    setIsUploading(true);
    setError(null);

    try {
      // Initialize storage if needed
      if (!tokenImageStorage['db']) {
        await tokenImageStorage.initialize();
      }

      const checksums: string[] = [];

      // Process files with progress tracking
      const processed = await processImageFiles(
        files,
        (current, total, filename) => {
          setProgress({
            current,
            total,
            filename,
            percentage: Math.round((current / total) * 100),
          });
        },
      );

      // Store each processed image
      for (const image of processed) {
        // Check if image already exists
        const exists = await tokenImageStorage.hasImage(image.hash);
        if (exists) {
          console.log(
            `ℹ️ Image already exists: ${image.filename} (${image.hash.substring(0, 8)}...)`,
          );
          checksums.push(image.hash);
          continue;
        }

        // Store in IndexedDB
        await tokenImageStorage.storeImage(
          image.hash,
          image.blob,
          image.width,
          image.height,
          image.thumbnailHash,
          image.thumbnailBlob,
          image.filename,
        );

        checksums.push(image.hash);
      }

      return checksums;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to upload images';
      setError(errorMessage);
      console.error('Image upload failed:', err);
      throw err;
    } finally {
      setIsUploading(false);
      setTimeout(() => setProgress(null), 2000);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isUploading,
    progress,
    error,
    uploadImage,
    uploadImages,
    clearError,
  };
};

/**
 * Hook for loading images from storage
 */
export const useImage = (checksum: string | null): string | null => {
  const [url, setUrl] = useState<string | null>(null);

  useState(() => {
    if (!checksum) {
      setUrl(null);
      return;
    }

    // Load image URL from storage
    const loadImage = async () => {
      try {
        if (!tokenImageStorage['db']) {
          await tokenImageStorage.initialize();
        }

        const imageUrl = await tokenImageStorage.getImageURL(checksum);
        setUrl(imageUrl);

        // If image not found, could trigger a network request here
        if (!imageUrl) {
          console.warn(
            `Image not found in storage: ${checksum.substring(0, 8)}...`,
          );
        }
      } catch (err) {
        console.error('Failed to load image:', err);
        setUrl(null);
      }
    };

    loadImage();
  });

  return url;
};
