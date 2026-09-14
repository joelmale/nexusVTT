import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';

class S3Service {
  private client: S3Client;
  private publicClient: S3Client;
  private bucket: string;

  constructor() {
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    });

    // Create a separate client for public pre-signed URLs
    const publicEndpoint = env.S3_PUBLIC_ENDPOINT || env.S3_ENDPOINT;
    this.publicClient = new S3Client({
      endpoint: publicEndpoint,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    });

    this.bucket = env.S3_BUCKET;
  }

  /**
   * Initialize S3 bucket (create if it doesn't exist)
   */
  async initializeBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      console.log(`Bucket "${this.bucket}" already exists`);
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        console.log(`Creating bucket "${this.bucket}"...`);
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        console.log(`Bucket "${this.bucket}" created successfully`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Generate a pre-signed URL for uploading a file
   */
  async getUploadUrl(key: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    // Use publicClient for pre-signed URLs so they work from outside Docker
    return getSignedUrl(this.publicClient, command, {
      expiresIn: env.UPLOAD_URL_EXPIRY,
    });
  }

  /**
   * Generate a pre-signed URL for downloading a file
   */
  async getDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    // Use publicClient for download URLs so browsers can access them
    return getSignedUrl(this.publicClient, command, {
      expiresIn: env.DOWNLOAD_URL_EXPIRY,
    });
  }

  /**
   * Get object metadata (for Range request support)
   */
  async getObject(key: string, range?: string) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Range: range,
    });

    return this.client.send(command);
  }

  /**
   * Check if object exists (get metadata only)
   */
  async headObject(key: string): Promise<void> {
    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  /**
   * Delete an object from S3
   */
  async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  /**
   * Upload a file directly (used for thumbnails)
   */
  async uploadFile(key: string, body: Buffer, contentType: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    await this.client.send(command);
  }
}

export const s3Service = new S3Service();
