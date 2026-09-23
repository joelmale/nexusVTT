import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenImageStorage } from '@/services/tokenImageStorage';

describe('token image storage', () => {
  beforeEach(async () => { await tokenImageStorage.initialize(); vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:image'), revokeObjectURL: vi.fn() }); });
  afterEach(() => vi.unstubAllGlobals());

  it('stores full images and thumbnails, caches URLs, and deletes related metadata', async () => {
    const image = new Blob(['full'], { type: 'image/png' }); const thumbnail = new Blob(['thumb'], { type: 'image/png' });
    await tokenImageStorage.storeImage('full-hash', image, 100, 80, 'thumb-hash', thumbnail, 'token.png');
    expect(await tokenImageStorage.hasImage('full-hash')).toBe(true);
    expect(await tokenImageStorage.getMetadata('full-hash')).toMatchObject({ filename: 'token.png', thumbnailChecksum: 'thumb-hash' });
    expect(await tokenImageStorage.getImageURL('full-hash')).toBe('blob:image');
    expect(await tokenImageStorage.getImageURL('full-hash')).toBe('blob:image');
    expect(await tokenImageStorage.getThumbnailURL('full-hash')).toBe('blob:image');
    expect(await tokenImageStorage.getStats()).toEqual({ imageCount: 1, totalSize: image.size });
    await tokenImageStorage.deleteImage('full-hash');
    expect(await tokenImageStorage.hasImage('full-hash')).toBe(false); expect(await tokenImageStorage.getImage('thumb-hash')).toBeNull();
  });
});
