import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { isSafeRelativeKey, isWithinRoot, resolveWithinRoot } from './pathSafety';
import { AdminError } from './errors';

let base: string;
let root: string;
let outside: string;

beforeAll(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-path-safety-'));
  root = path.join(base, 'root');
  outside = path.join(base, 'outside');
  fs.mkdirSync(path.join(root, 'blobs', 'ab'), { recursive: true });
  fs.mkdirSync(outside, { recursive: true });
  fs.writeFileSync(path.join(root, 'blobs', 'ab', 'ok.png'), 'ok');
  fs.writeFileSync(path.join(outside, 'secret.png'), 'secret');
  // Directory junctions need no privileges on Windows; plain dir symlinks elsewhere.
  fs.symlinkSync(outside, path.join(root, 'blobs', 'escape'), 'junction');
});

afterAll(() => {
  fs.rmSync(base, { recursive: true, force: true });
});

describe('isSafeRelativeKey', () => {
  it.each([
    'blobs/ab/abc.png',
    'derivatives/v1/ab/abc.webp',
    'a',
    'blobs/ab/name-with_under.score.png',
  ])('accepts %s', (key) => {
    expect(isSafeRelativeKey(key)).toBe(true);
  });

  it.each([
    ['empty', ''],
    ['parent', '..'],
    ['leading parent', '../etc/passwd'],
    ['embedded parent', 'blobs/../../etc/passwd'],
    ['trailing parent', 'blobs/ab/..'],
    ['current dir', './blobs/ab/x.png'],
    ['absolute posix', '/etc/passwd'],
    ['windows drive', 'C:/Windows/win.ini'],
    ['windows drive backslash', 'C:\\Windows\\win.ini'],
    ['backslash traversal', 'blobs\\..\\..\\x'],
    ['UNC path', '\\\\server\\share\\x'],
    ['NUL byte', 'blobs/ab/x.png\0.webp'],
    ['percent-encoded traversal', 'blobs/%2e%2e/%2e%2e/x'],
    ['percent-encoded slash', '..%2F..%2Fetc%2Fpasswd'],
    ['double-encoded', '%252e%252e/x'],
    ['dot-prefixed admin area', '.admin/state.json'],
    ['dot-prefixed nested', 'blobs/.hidden/x'],
    ['alternate data stream', 'blobs/ab/x.png:stream'],
    ['url scheme', 'file:///etc/passwd'],
    ['empty segment', 'blobs//x.png'],
    ['trailing slash', 'blobs/ab/'],
    ['space-only segment', 'blobs/ /x'],
    ['over-long', `${'a/'.repeat(300)}x`],
  ])('rejects %s', (_label, key) => {
    expect(isSafeRelativeKey(key)).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isSafeRelativeKey(undefined)).toBe(false);
    expect(isSafeRelativeKey(42)).toBe(false);
    expect(isSafeRelativeKey(['blobs'])).toBe(false);
  });
});

describe('isWithinRoot', () => {
  it('distinguishes children from siblings that share a prefix', () => {
    expect(isWithinRoot(root, path.join(root, 'blobs'))).toBe(true);
    expect(isWithinRoot(root, root)).toBe(true);
    expect(isWithinRoot(root, `${root}-sibling`)).toBe(false);
    expect(isWithinRoot(root, path.dirname(root))).toBe(false);
  });
});

describe('resolveWithinRoot', () => {
  it('resolves an existing key beneath the root', async () => {
    const resolved = await resolveWithinRoot(root, 'blobs/ab/ok.png');
    expect(resolved.exists).toBe(true);
    expect(isWithinRoot(fs.realpathSync(root), resolved.absolutePath)).toBe(true);
  });

  it('resolves a not-yet-existing key when its ancestors are inside the root', async () => {
    const resolved = await resolveWithinRoot(root, 'blobs/cd/new.png');
    expect(resolved.exists).toBe(false);
  });

  it('rejects an existing file reached through a directory link that escapes the root', async () => {
    await expect(resolveWithinRoot(root, 'blobs/escape/secret.png')).rejects.toMatchObject({
      status: 400,
      code: 'unsafe-path',
    });
  });

  it('rejects a new file whose parent directory link escapes the root', async () => {
    await expect(resolveWithinRoot(root, 'blobs/escape/new/x.png')).rejects.toBeInstanceOf(
      AdminError,
    );
  });

  it('rejects a key whose final component is itself a link', async () => {
    await expect(resolveWithinRoot(root, 'blobs/escape')).rejects.toMatchObject({
      code: 'unsafe-path',
    });
  });

  it('rejects a file symlink pointing outside the root (when the platform allows file links)', async (context) => {
    const link = path.join(root, 'blobs', 'ab', 'link.png');
    try {
      fs.symlinkSync(path.join(outside, 'secret.png'), link, 'file');
    } catch {
      context.skip();
      return;
    }
    await expect(resolveWithinRoot(root, 'blobs/ab/link.png')).rejects.toMatchObject({
      code: 'unsafe-path',
    });
  });

  it('rejects lexically unsafe keys before touching the filesystem', async () => {
    for (const key of ['../outside/secret.png', '/etc/passwd', 'C:\\x', 'a/../../b']) {
      await expect(resolveWithinRoot(root, key)).rejects.toMatchObject({ code: 'unsafe-path' });
    }
  });

  it('reports an unavailable root without exposing it', async () => {
    const error = await resolveWithinRoot(path.join(base, 'missing-root'), 'blobs/x.png').catch(
      (e: unknown) => e,
    );
    expect(error).toMatchObject({ status: 503, code: 'storage-unavailable' });
    expect(String((error as Error).message)).not.toContain(base);
  });
});
