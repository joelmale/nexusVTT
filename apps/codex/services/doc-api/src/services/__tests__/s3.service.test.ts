import { describe, it, expect } from 'vitest';
import { s3Service } from '../s3.service';

describe('s3.service', () => {
  it('generates presigned upload URLs without automatic checksum query parameters', async () => {
    const uploadUrl = await s3Service.getUploadUrl('test-key.pdf', 'application/pdf');

    expect(uploadUrl).toContain('test-key.pdf');
    expect(uploadUrl).toContain('X-Amz-Signature');
    // Ensure automatic CRC32 checksum parameters are NOT injected into presigned upload URL
    expect(uploadUrl).not.toContain('x-amz-checksum');
    expect(uploadUrl).not.toContain('x-amz-sdk-checksum-algorithm');
  });

  it('generates presigned download URLs', async () => {
    const downloadUrl = await s3Service.getDownloadUrl('test-key.pdf');

    expect(downloadUrl).toContain('test-key.pdf');
    expect(downloadUrl).toContain('X-Amz-Signature');
  });
});
