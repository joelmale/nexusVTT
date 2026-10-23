import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildSimpleInviteUrl,
  readStoredUiMode,
  UI_MODE_STORAGE_KEY,
  writeStoredUiMode,
} from '@/utils/simplePlayerMode';

describe('simplePlayerMode utils', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('builds a /play link that honours the base URL', () => {
    expect(buildSimpleInviteUrl('abcd', 'https://vtt.test', '/')).toBe(
      'https://vtt.test/play/ABCD',
    );
    expect(buildSimpleInviteUrl('ABCD', 'https://vtt.test', '/vtt')).toBe(
      'https://vtt.test/vtt/play/ABCD',
    );
  });

  it('round-trips the stored preference and ignores junk', () => {
    expect(readStoredUiMode()).toBeNull();
    writeStoredUiMode('simple');
    expect(readStoredUiMode()).toBe('simple');
    localStorage.setItem(UI_MODE_STORAGE_KEY, 'weird');
    expect(readStoredUiMode()).toBeNull();
  });

  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readStoredUiMode()).toBeNull();
    expect(() => writeStoredUiMode('full')).not.toThrow();
  });
});
