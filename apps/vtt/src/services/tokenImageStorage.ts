/**
 * IndexedDB storage for token images
 * Based on Ogres VTT approach: hash-based image storage with separate metadata
 */

interface ImageRecord {
  checksum: string; // SHA-1 hash (serves as primary key)
  blob: Blob;
  width: number;
  height: number;
  thumbnailChecksum?: string; // Reference to thumbnail image
  filename?: string;
  uploadedAt: number;
}

interface ImageMetadata {
  checksum: string;
  filename: string;
  size: number;
  width: number;
  height: number;
  thumbnailChecksum: string;
  uploadedAt: number;
}

class TokenImageStorage {
  private dbName = 'nexus-token-images';
  private version = 1;
  private db: IDBDatabase | null = null;
  private urlCache = new Map<string, string>(); // checksum -> object URL

  /**
   * Initialize the IndexedDB
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ Token image storage initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store for images with checksum as key
        if (!db.objectStoreNames.contains('images')) {
          const imageStore = db.createObjectStore('images', {
            keyPath: 'checksum',
          });
          imageStore.createIndex('filename', 'filename', { unique: false });
          imageStore.createIndex('uploadedAt', 'uploadedAt', { unique: false });
          console.log('📦 Created "images" object store');
        }

        // Create object store for metadata
        if (!db.objectStoreNames.contains('metadata')) {
          const metadataStore = db.createObjectStore('metadata', {
            keyPath: 'checksum',
          });
          metadataStore.createIndex('filename', 'filename', { unique: false });
          console.log('📦 Created "metadata" object store');
        }
      };
    });
  }

  /**
   * Store an image with its thumbnail
   */
  async storeImage(
    checksum: string,
    blob: Blob,
    width: number,
    height: number,
    thumbnailChecksum: string,
    thumbnailBlob: Blob,
    filename: string,
  ): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const transaction = this.db.transaction(
      ['images', 'metadata'],
      'readwrite',
    );
    const imageStore = transaction.objectStore('images');
    const metadataStore = transaction.objectStore('metadata');

    // Store full-size image
    const imageRecord: ImageRecord = {
      checksum,
      blob,
      width,
      height,
      thumbnailChecksum,
      filename,
      uploadedAt: Date.now(),
    };

    // Store thumbnail image
    const thumbnailRecord: ImageRecord = {
      checksum: thumbnailChecksum,
      blob: thumbnailBlob,
      width: 256,
      height: 256,
      uploadedAt: Date.now(),
    };

    // Store metadata
    const metadata: ImageMetadata = {
      checksum,
      filename,
      size: blob.size,
      width,
      height,
      thumbnailChecksum,
      uploadedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        console.log(
          `✅ Stored image: ${filename} (${checksum.substring(0, 8)}...)`,
        );
        resolve();
      };

      transaction.onerror = () => {
        console.error('Failed to store image:', transaction.error);
        reject(transaction.error);
      };

      imageStore.put(imageRecord);
      imageStore.put(thumbnailRecord);
      metadataStore.put(metadata);
    });
  }

  /**
   * Get an image by checksum
   */
  async getImage(checksum: string): Promise<Blob | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const transaction = this.db.transaction(['images'], 'readonly');
    const store = transaction.objectStore('images');

    return new Promise((resolve, reject) => {
      const request = store.get(checksum);

      request.onsuccess = () => {
        const record = request.result as ImageRecord | undefined;
        resolve(record ? record.blob : null);
      };

      request.onerror = () => {
        console.error('Failed to get image:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get an image URL (creates object URL and caches it)
   */
  async getImageURL(checksum: string): Promise<string | null> {
    // Check cache first
    if (this.urlCache.has(checksum)) {
      return this.urlCache.get(checksum)!;
    }

    // Load from IndexedDB
    const blob = await this.getImage(checksum);
    if (!blob) {
      return null;
    }

    // Create object URL and cache it
    const url = URL.createObjectURL(blob);
    this.urlCache.set(checksum, url);
    return url;
  }

  /**
   * Get thumbnail URL
   */
  async getThumbnailURL(checksum: string): Promise<string | null> {
    const metadata = await this.getMetadata(checksum);
    if (!metadata || !metadata.thumbnailChecksum) {
      return null;
    }

    return this.getImageURL(metadata.thumbnailChecksum);
  }

  /**
   * Get image metadata
   */
  async getMetadata(checksum: string): Promise<ImageMetadata | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const transaction = this.db.transaction(['metadata'], 'readonly');
    const store = transaction.objectStore('metadata');

    return new Promise((resolve, reject) => {
      const request = store.get(checksum);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error('Failed to get metadata:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all metadata
   */
  async getAllMetadata(): Promise<ImageMetadata[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const transaction = this.db.transaction(['metadata'], 'readonly');
    const store = transaction.objectStore('metadata');

    return new Promise((resolve, reject) => {
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('Failed to get all metadata:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Check if an image exists
   */
  async hasImage(checksum: string): Promise<boolean> {
    const blob = await this.getImage(checksum);
    return blob !== null;
  }

  /**
   * Delete an image and its thumbnail
   */
  async deleteImage(checksum: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const metadata = await this.getMetadata(checksum);
    if (!metadata) {
      return;
    }

    const transaction = this.db.transaction(
      ['images', 'metadata'],
      'readwrite',
    );
    const imageStore = transaction.objectStore('images');
    const metadataStore = transaction.objectStore('metadata');

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        // Revoke cached URLs
        if (this.urlCache.has(checksum)) {
          URL.revokeObjectURL(this.urlCache.get(checksum)!);
          this.urlCache.delete(checksum);
        }
        if (
          metadata.thumbnailChecksum &&
          this.urlCache.has(metadata.thumbnailChecksum)
        ) {
          URL.revokeObjectURL(this.urlCache.get(metadata.thumbnailChecksum)!);
          this.urlCache.delete(metadata.thumbnailChecksum);
        }

        console.log(`🗑️ Deleted image: ${checksum.substring(0, 8)}...`);
        resolve();
      };

      transaction.onerror = () => {
        console.error('Failed to delete image:', transaction.error);
        reject(transaction.error);
      };

      imageStore.delete(checksum);
      if (metadata.thumbnailChecksum) {
        imageStore.delete(metadata.thumbnailChecksum);
      }
      metadataStore.delete(checksum);
    });
  }

  /**
   * Clear all cached URLs
   */
  clearURLCache(): void {
    for (const url of this.urlCache.values()) {
      URL.revokeObjectURL(url);
    }
    this.urlCache.clear();
    console.log('🧹 Cleared URL cache');
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    imageCount: number;
    totalSize: number;
  }> {
    const metadata = await this.getAllMetadata();
    const totalSize = metadata.reduce((sum, item) => sum + item.size, 0);

    return {
      imageCount: metadata.length,
      totalSize,
    };
  }
}

// Export singleton instance
export const tokenImageStorage = new TokenImageStorage();
