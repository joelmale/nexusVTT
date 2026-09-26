import { describe, it, expect, vi, beforeEach } from 'vitest';
import { s3Service } from '../s3.service';

describe('doc-processor s3.service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('instantiates S3Service successfully with configured options', () => {
    expect(s3Service).toBeDefined();
    expect(typeof s3Service.downloadFile).toBe('function');
    expect(typeof s3Service.uploadFile).toBe('function');
    expect(typeof s3Service.deleteFile).toBe('function');
  });

  it('uploads a file to S3 using S3Client.send', async () => {
    const sendSpy = vi.spyOn((s3Service as any).client, 'send').mockResolvedValueOnce({} as any);

    await s3Service.uploadFile('test.txt', Buffer.from('hello'), 'text/plain');

    expect(sendSpy).toHaveBeenCalledOnce();
    const command = sendSpy.mock.calls[0][0] as any;
    expect(command.input.Key).toBe('test.txt');
    expect(command.input.ContentType).toBe('text/plain');
  });

  it('deletes a file from S3 using S3Client.send', async () => {
    const sendSpy = vi.spyOn((s3Service as any).client, 'send').mockResolvedValueOnce({} as any);

    await s3Service.deleteFile('test.txt');

    expect(sendSpy).toHaveBeenCalledOnce();
    const command = sendSpy.mock.calls[0][0] as any;
    expect(command.input.Key).toBe('test.txt');
  });
});
