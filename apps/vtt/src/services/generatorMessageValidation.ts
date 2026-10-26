import type { GeneratorExportArtifact } from '../../shared/generator/protocol';

const SOURCES = new Set(['dungeon', 'world', 'cave', 'city', 'dwelling']);
const MIME_TYPES = new Set(['image/png', 'image/webp', 'image/svg+xml']);

/** postMessage data is untrusted even when its sender passed the origin check. */
export function isGeneratorExportArtifact(
  value: unknown,
): value is GeneratorExportArtifact {
  if (!value || typeof value !== 'object') return false;
  const artifact = value as Record<string, unknown>;
  if (
    typeof artifact.exportId !== 'string' ||
    !/^[\w-]{1,128}$/.test(artifact.exportId) ||
    typeof artifact.source !== 'string' ||
    !SOURCES.has(artifact.source) ||
    !artifact.payload ||
    typeof artifact.payload !== 'object'
  )
    return false;
  const payload = artifact.payload as Record<string, unknown>;
  if (
    !(payload.blob instanceof Blob) ||
    typeof payload.mimeType !== 'string' ||
    !MIME_TYPES.has(payload.mimeType)
  )
    return false;
  if (payload.kind === 'raster' && payload.mimeType === 'image/svg+xml')
    return false;
  if (payload.kind !== 'raster' && payload.kind !== 'svg-master') return false;
  if (payload.kind === 'svg-master' && payload.mimeType !== 'image/svg+xml')
    return false;
  return ['width', 'height'].every((key) =>
    payload[key] === undefined
      ? payload.kind === 'svg-master'
      : typeof payload[key] === 'number' &&
        Number.isFinite(payload[key]) &&
        payload[key] > 0 &&
        payload[key] <= 32768,
  );
}
