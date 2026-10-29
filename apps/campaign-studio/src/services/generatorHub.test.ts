import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EXPORT_TIMEOUT_MS,
  GENERATORS,
  GeneratorAuthRequiredError,
  GeneratorExportError,
  generatorLabel,
  getGeneratorUrl,
  getHubOrigin,
  isBlankImage,
  looksBlank,
  requestGeneratorExport,
  uploadGeneratedMap,
} from './generatorHub';

const HUB = 'https://studio.example.com';

function fakeFrame() {
  return { postMessage: vi.fn() } as unknown as Window & {
    postMessage: ReturnType<typeof vi.fn>;
  };
}

function send(data: unknown, init: { origin?: string; source?: Window | null } = {}) {
  window.dispatchEvent(
    new MessageEvent('message', {
      data,
      origin: init.origin ?? HUB,
      source: (init.source ?? null) as MessageEventSource | null,
    }),
  );
}

const ready = (blob: unknown, extra: Record<string, unknown> = {}) => ({
  type: 'generator/export-ready',
  payload: {
    source: 'cave',
    payload: { kind: 'raster', blob, mimeType: 'image/webp', width: 2000, height: 1500, ...extra },
  },
});

describe('generator hub urls', () => {
  it('lists the five generators', () => {
    expect(GENERATORS.map((generator) => generator.id)).toEqual([
      'dungeon',
      'cave',
      'city',
      'world',
      'dwelling',
    ]);
    expect(generatorLabel('dwelling')).toBe('Dwelling');
  });

  it('builds a hub URL that selects the generator and asks for raster output', () => {
    const url = new URL(getGeneratorUrl('city', '/generator-hub/'));
    expect(url.pathname).toBe('/generator-hub/');
    expect(url.searchParams.get('generator')).toBe('city');
    expect(url.searchParams.get('rasterize')).toBe('true');
    expect(getGeneratorUrl('world', 'http://localhost:5174')).toContain(
      'http://localhost:5174/?generator=world',
    );
  });

  it('derives the hub origin for message checks', () => {
    expect(getHubOrigin('http://localhost:5174/some/path')).toBe('http://localhost:5174');
    expect(getHubOrigin('/generator-hub/')).toBe(window.location.origin);
  });
});

describe('requestGeneratorExport', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('asks the hub for an export and resolves with the image', async () => {
    const frame = fakeFrame();
    const promise = requestGeneratorExport(frame, HUB);
    expect(frame.postMessage).toHaveBeenCalledWith({ type: 'generator/export-request' }, HUB);

    const blob = new Blob(['x'], { type: 'image/webp' });
    send(ready(blob), { source: frame });
    await expect(promise).resolves.toMatchObject({
      blob,
      mimeType: 'image/webp',
      width: 2000,
      height: 1500,
      source: 'cave',
    });
  });

  it('ignores messages from another origin or another window', async () => {
    const frame = fakeFrame();
    const promise = requestGeneratorExport(frame, HUB);
    const blob = new Blob(['x']);
    send(ready(blob), { origin: 'https://evil.example.com', source: frame });
    send(ready(blob), { source: fakeFrame() });
    send({ type: 'something-else' }, { source: frame });

    let settled = false;
    void promise.then(
      () => (settled = true),
      () => (settled = true),
    );
    await vi.advanceTimersByTimeAsync(100);
    expect(settled).toBe(false);

    send(ready(blob), { source: frame });
    await expect(promise).resolves.toMatchObject({ blob });
  });

  it('rejects with the hub error message', async () => {
    const frame = fakeFrame();
    const promise = requestGeneratorExport(frame, HUB);
    send({ type: 'generator/export-error', payload: { error: 'No map yet' } }, { source: frame });
    await expect(promise).rejects.toThrow('No map yet');
    await expect(promise).rejects.toBeInstanceOf(GeneratorExportError);
  });

  it('rejects when the export carries no image', async () => {
    const frame = fakeFrame();
    const promise = requestGeneratorExport(frame, HUB);
    send(ready('not-a-blob'), { source: frame });
    await expect(promise).rejects.toThrow('no image');
  });

  it('times out with a message that says what to do', async () => {
    const promise = requestGeneratorExport(fakeFrame(), HUB);
    const assertion = expect(promise).rejects.toThrow('did not respond');
    await vi.advanceTimersByTimeAsync(EXPORT_TIMEOUT_MS + 1);
    await assertion;
  });

  it('stops listening once settled', async () => {
    const frame = fakeFrame();
    const remove = vi.spyOn(window, 'removeEventListener');
    const promise = requestGeneratorExport(frame, HUB);
    send(ready(new Blob(['x'])), { source: frame });
    await promise;
    expect(remove).toHaveBeenCalledWith('message', expect.any(Function));
  });
});

describe('uploadGeneratedMap', () => {
  const input = {
    blob: new Blob(['x'], { type: 'image/webp' }),
    mimeType: 'image/webp',
    name: 'Generated cave',
    generator: 'cave' as const,
    width: 2000,
    height: 1500,
  };

  afterEach(() => vi.restoreAllMocks());

  it('posts the file and metadata and returns the stored asset', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          importId: 'i1',
          assetId: 'asset-1',
          sceneUrl: '/users/u1/generated/asset-1.webp',
          width: 1800,
          height: 1200,
        }),
        { status: 200 },
      ),
    );
    const stored = await uploadGeneratedMap(input);
    expect(stored).toEqual({
      importId: 'i1',
      assetId: 'asset-1',
      sceneUrl: '/users/u1/generated/asset-1.webp',
      width: 1800,
      height: 1200,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/generated-maps');
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' });
    const form = (init as RequestInit).body as FormData;
    expect(form.get('name')).toBe('Generated cave');
    expect(form.get('generator')).toBe('cave');
    expect(form.get('width')).toBe('2000');
    expect(form.get('importId')).toEqual(expect.any(String));
    expect((form.get('file') as File).name).toMatch(/^generated-cave-.*\.webp$/);
  });

  it('falls back to the measured size when the server omits dimensions', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ assetId: 'a', sceneUrl: '/users/u/generated/a.webp' }), {
        status: 200,
      }),
    );
    await expect(uploadGeneratedMap(input)).resolves.toMatchObject({ width: 2000, height: 1500 });
  });

  it.each([401, 403])('reports a signed-out or guest session (%i) as an auth error', async (status) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status }));
    await expect(uploadGeneratedMap(input)).rejects.toBeInstanceOf(GeneratorAuthRequiredError);
  });

  it('reports other failures and malformed responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 500 }));
    await expect(uploadGeneratedMap(input)).rejects.toThrow('status 500');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await expect(uploadGeneratedMap(input)).rejects.toThrow('did not return');
  });
});

describe('blank export detection', () => {
  const flat = (rgba: number[], pixels = 16) =>
    Uint8ClampedArray.from(Array.from({ length: pixels }, () => rgba).flat());

  it('flags a single flat color, however it is filled', () => {
    expect(looksBlank(flat([0, 0, 0, 255]))).toBe(true);
    expect(looksBlank(flat([255, 255, 255, 255]))).toBe(true);
    expect(looksBlank(flat([0, 0, 0, 0]))).toBe(true);
    // Compression-style noise inside one 4-bit bucket still counts as flat.
    const noisy = flat([100, 100, 100, 255]);
    noisy[0] = 103;
    noisy[5] = 98;
    expect(looksBlank(noisy)).toBe(true);
  });

  it('accepts anything with real content', () => {
    const map = flat([240, 230, 200, 255]);
    map[8] = 40;
    map[9] = 30;
    map[10] = 20;
    expect(looksBlank(map)).toBe(false);
    // One differing pixel is enough: sparse maps are not blank.
    const sparse = flat([255, 255, 255, 255], 4096);
    sparse[4 * 2000] = 0;
    expect(looksBlank(sparse)).toBe(false);
  });

  it('never calls an empty or tiny buffer blank', () => {
    expect(looksBlank(new Uint8ClampedArray())).toBe(false);
    expect(looksBlank(new Uint8ClampedArray([1, 2]))).toBe(false);
  });

  it('does not reject an image it cannot sample', async () => {
    // jsdom has no canvas, so the check must fail open rather than block a map.
    await expect(isBlankImage(new Blob(['x'], { type: 'image/png' }))).resolves.toBe(false);
  });
});
