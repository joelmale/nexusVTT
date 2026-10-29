/**
 * Client for the VTT's map generator hub (one-page dungeon, cave, city, world,
 * dwelling), used by the map picker's Generate tab.
 *
 * The hub runs in an iframe. Studio asks it for an export over postMessage and
 * gets the finished image back as a Blob, then stores it through the VTT's
 * generated-map route so the map becomes a real asset. The message shapes
 * mirror apps/vtt/shared/generator/protocol.ts; only what Studio needs is
 * copied here, so Studio does not import across apps.
 */

export type GeneratorKind = 'dungeon' | 'cave' | 'city' | 'world' | 'dwelling';

export interface GeneratorOption {
  id: GeneratorKind;
  label: string;
  blurb: string;
}

export const GENERATORS: readonly GeneratorOption[] = [
  { id: 'dungeon', label: 'Dungeon', blurb: 'One-page dungeon' },
  { id: 'cave', label: 'Cave', blurb: 'Winding cave system' },
  { id: 'city', label: 'City', blurb: 'Medieval city' },
  { id: 'world', label: 'World', blurb: 'Fantasy world map' },
  { id: 'dwelling', label: 'Dwelling', blurb: 'House or dwelling floor plan' },
];

export function generatorLabel(kind: GeneratorKind): string {
  return GENERATORS.find((generator) => generator.id === kind)?.label ?? kind;
}

/** Where the hub is served: the gateway mount, or the hub dev server. */
export function getHubBaseUrl(): string {
  const configured = import.meta.env.VITE_GENERATOR_HUB_URL as string | undefined;
  return configured || (import.meta.env.DEV ? 'http://localhost:5174' : '/generator-hub/');
}

function absolute(url: string): URL {
  const base = typeof window === 'undefined' ? 'http://localhost/' : window.location.href;
  return new URL(url, base);
}

/** The hub document for one generator. Raster output is requested so the export is an image. */
export function getGeneratorUrl(kind: GeneratorKind, baseUrl = getHubBaseUrl()): string {
  const url = absolute(baseUrl);
  url.searchParams.set('generator', kind);
  url.searchParams.set('rasterize', 'true');
  return url.toString();
}

export function getHubOrigin(baseUrl = getHubBaseUrl()): string {
  return absolute(baseUrl).origin;
}

export interface GeneratedExport {
  blob: Blob;
  mimeType: string;
  width?: number;
  height?: number;
  source?: string;
}

export class GeneratorExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeneratorExportError';
  }
}

export const EXPORT_TIMEOUT_MS = 8000;

interface ExportMessage {
  type?: string;
  payload?: {
    source?: string;
    payload?: { blob?: unknown; mimeType?: string; width?: number; height?: number };
    error?: string;
  };
}

/**
 * Asks the hub (in `frame`) to export the map it is showing. Only messages from
 * the hub's own origin and window are accepted; anything else is ignored.
 */
export function requestGeneratorExport(
  frame: Window,
  hubOrigin: string,
  timeoutMs = EXPORT_TIMEOUT_MS,
): Promise<GeneratedExport> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== hubOrigin || event.source !== frame) return;
      const message = event.data as ExportMessage | null;
      if (message?.type === 'generator/export-error') {
        cleanup();
        reject(
          new GeneratorExportError(message.payload?.error || 'The generator could not export this map.'),
        );
        return;
      }
      if (message?.type !== 'generator/export-ready') return;
      const inner = message.payload?.payload;
      if (!(inner?.blob instanceof Blob)) {
        cleanup();
        reject(new GeneratorExportError('The generator returned no image.'));
        return;
      }
      cleanup();
      resolve({
        blob: inner.blob,
        mimeType: inner.mimeType || inner.blob.type || 'image/webp',
        width: inner.width,
        height: inner.height,
        source: message.payload?.source,
      });
    };
    const timer = window.setTimeout(() => {
      cleanup();
      reject(
        new GeneratorExportError(
          'The generator did not respond. Wait for the map to finish drawing, then try again.',
        ),
      );
    }, timeoutMs);
    window.addEventListener('message', onMessage);
    frame.postMessage({ type: 'generator/export-request' }, hubOrigin);
  });
}

/** Thrown when the session may not save assets (signed out, or a guest). */
export class GeneratorAuthRequiredError extends Error {
  constructor(message = 'Sign in to Nexus VTT to save generated maps.') {
    super(message);
    this.name = 'GeneratorAuthRequiredError';
  }
}

export interface StoredGeneratedMap {
  importId: string;
  assetId: string;
  /** Path the stored image is served from, for example /users/<id>/generated/<file>. */
  sceneUrl: string;
  width: number;
  height: number;
}

export interface UploadGeneratedMapInput {
  blob: Blob;
  mimeType: string;
  name: string;
  generator: GeneratorKind;
  width: number;
  height: number;
}

function extensionFor(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/svg+xml') return 'svg';
  return 'webp';
}

/** Saves a generated image as a user asset and returns where it now lives. */
export async function uploadGeneratedMap(
  input: UploadGeneratedMapInput,
): Promise<StoredGeneratedMap> {
  const importId = crypto.randomUUID();
  const form = new FormData();
  form.append(
    'file',
    input.blob,
    `generated-${input.generator}-${importId.slice(0, 8)}.${extensionFor(input.mimeType)}`,
  );
  form.append('importId', importId);
  form.append('width', String(input.width));
  form.append('height', String(input.height));
  form.append('name', input.name);
  form.append('generator', input.generator);

  const response = await fetch('/api/generated-maps', {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  if (response.status === 401 || response.status === 403) {
    throw new GeneratorAuthRequiredError();
  }
  if (!response.ok) {
    throw new Error(`Could not save the generated map (status ${response.status}).`);
  }
  const body = (await response.json()) as Partial<StoredGeneratedMap>;
  if (typeof body.assetId !== 'string' || typeof body.sceneUrl !== 'string') {
    throw new Error('The server did not return the saved map.');
  }
  return {
    importId: typeof body.importId === 'string' ? body.importId : importId,
    assetId: body.assetId,
    sceneUrl: body.sceneUrl,
    width: typeof body.width === 'number' && body.width > 0 ? body.width : input.width,
    height: typeof body.height === 'number' && body.height > 0 ? body.height : input.height,
  };
}

/**
 * True when RGBA pixel data holds a single flat color (after rounding each
 * channel to 4 bits, so JPEG-style noise cannot hide it). A generator that has
 * not drawn yet exports exactly this.
 */
export function looksBlank(pixels: ArrayLike<number>): boolean {
  if (pixels.length < 4) return false;
  const first = [pixels[0] >> 4, pixels[1] >> 4, pixels[2] >> 4, pixels[3] >> 4];
  for (let i = 4; i + 3 < pixels.length; i += 4) {
    if (
      pixels[i] >> 4 !== first[0] ||
      pixels[i + 1] >> 4 !== first[1] ||
      pixels[i + 2] >> 4 !== first[2] ||
      pixels[i + 3] >> 4 !== first[3]
    ) {
      return false;
    }
  }
  return true;
}

const SAMPLE_SIZE = 64;

/**
 * True when an exported image is one flat color, which means the generator had
 * not drawn a map when it was asked. Returns false when the image cannot be
 * sampled (no canvas support), so a real map is never rejected by mistake.
 */
export async function isBlankImage(blob: Blob): Promise<boolean> {
  try {
    if (typeof createImageBitmap !== 'function') return false;
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return false;
    }
    context.drawImage(bitmap, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    bitmap.close();
    return looksBlank(context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data);
  } catch {
    return false;
  }
}

/** The pixel size of an image blob, or null when it cannot be decoded. */
export async function measureImage(
  blob: Blob,
): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);
      const size = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      if (size.width > 0 && size.height > 0) return size;
    } catch {
      // fall through to the Image element
    }
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(
        img.naturalWidth > 0 && img.naturalHeight > 0
          ? { width: img.naturalWidth, height: img.naturalHeight }
          : null,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
