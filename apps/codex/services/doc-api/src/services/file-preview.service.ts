import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { s3Service } from './s3.service';

export interface FilePreview {
  mimeType: string;
  extension: string;
  size: number;
  thumbnailUrl?: string;
  previewText?: string;
  metadata: Record<string, unknown>;
  [key: string]: unknown; // Index signature for Prisma Json compatibility
}

export interface PreviewOptions {
  generateThumbnail?: boolean;
  thumbnailSize?: number;
  maxPreviewTextLength?: number;
}

export class FilePreviewService {
  private static readonly THUMBNAIL_SIZE = 300;
  private static readonly MAX_PREVIEW_TEXT = 1000;

  /**
   * Analyze file and generate preview information
   */
  static async generatePreview(
    storageKey: string,
    options: PreviewOptions = {}
  ): Promise<FilePreview> {
    const {
      generateThumbnail = true,
      thumbnailSize = this.THUMBNAIL_SIZE,
      maxPreviewTextLength = this.MAX_PREVIEW_TEXT,
    } = options;

    try {
      // Download file from S3
      const response = await s3Service.getObject(storageKey);
      const fileBuffer = Buffer.from(await response.Body?.transformToByteArray() || new Uint8Array());

      // Detect file type
      const fileType = await fileTypeFromBuffer(fileBuffer);
      if (!fileType) {
        throw new Error('Unable to detect file type');
      }

      const preview: FilePreview = {
        mimeType: fileType.mime,
        extension: fileType.ext,
        size: fileBuffer.length,
        metadata: {},
      };

      // Generate thumbnail for images
      if (generateThumbnail && this.isImageType(fileType.mime)) {
        try {
          const thumbnailBuffer = await sharp(fileBuffer)
            .resize(thumbnailSize, thumbnailSize, {
              fit: 'inside',
              withoutEnlargement: true,
            })
            .jpeg({ quality: 80 })
            .toBuffer();

          const thumbnailKey = `${storageKey}.thumb.jpg`;
          await s3Service.uploadFile(thumbnailKey, thumbnailBuffer, 'image/jpeg');

          const thumbnailUrl = await s3Service.getDownloadUrl(thumbnailKey);
          preview.thumbnailUrl = thumbnailUrl;
        } catch (thumbnailError) {
          console.warn('Failed to generate thumbnail:', thumbnailError);
        }
      }

      // Generate preview text for text-based files
      if (this.isTextType(fileType.mime)) {
        try {
          const textContent = fileBuffer.toString('utf-8');
          preview.previewText = textContent.substring(0, maxPreviewTextLength);
          if (textContent.length > maxPreviewTextLength) {
            preview.previewText += '...';
          }
        } catch (textError) {
          console.warn('Failed to extract preview text:', textError);
        }
      }

      // Extract metadata based on file type
      preview.metadata = await this.extractMetadata(fileBuffer, fileType);

      return preview;
    } catch (error) {
      console.error('Error generating file preview:', error);
      throw new Error(`Failed to generate preview: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if file type is an image
   */
  private static isImageType(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  /**
   * Check if file type is text-based
   */
  private static isTextType(mimeType: string): boolean {
    return (
      mimeType.startsWith('text/') ||
      mimeType === 'application/json' ||
      mimeType === 'application/markdown' ||
      mimeType === 'application/x-markdown'
    );
  }

  /**
   * Extract metadata based on file type
   */
  private static async extractMetadata(
    buffer: Buffer,
    fileType: { mime: string; ext: string }
  ): Promise<Record<string, any>> {
    const metadata: Record<string, any> = {
      detectedType: fileType.ext,
      mimeType: fileType.mime,
    };

    try {
      // Extract image metadata
      if (this.isImageType(fileType.mime)) {
        const imageMetadata = await sharp(buffer).metadata();
        metadata.width = imageMetadata.width;
        metadata.height = imageMetadata.height;
        metadata.colorSpace = imageMetadata.space;
        metadata.hasAlpha = imageMetadata.hasAlpha;
      }

      // Extract PDF metadata (basic)
      if (fileType.mime === 'application/pdf') {
        // For now, just mark as PDF - more detailed extraction would require pdf-parse
        metadata.isPDF = true;
      }

      // Extract text file info
      if (this.isTextType(fileType.mime)) {
        const text = buffer.toString('utf-8');
        metadata.lineCount = text.split('\n').length;
        metadata.charCount = text.length;
        metadata.encoding = 'utf-8';
      }
    } catch (error) {
      console.warn('Failed to extract detailed metadata:', error);
    }

    return metadata;
  }

  /**
   * Get supported file types for preview generation
   */
  static getSupportedTypes(): string[] {
    return [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/bmp',
      'image/tiff',
      'text/plain',
      'text/markdown',
      'text/html',
      'application/json',
      'application/pdf',
    ];
  }

  /**
   * Validate if file type supports preview generation
   */
  static supportsPreview(mimeType: string): boolean {
    return this.getSupportedTypes().includes(mimeType);
  }
}