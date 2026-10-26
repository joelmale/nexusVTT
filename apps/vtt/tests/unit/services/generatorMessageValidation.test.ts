import { describe, expect, it } from 'vitest';
import { isGeneratorExportArtifact } from '@/services/generatorMessageValidation';

const artifact = () => ({
  exportId: 'map-1',
  source: 'dungeon',
  payload: {
    kind: 'raster',
    mimeType: 'image/png',
    blob: new Blob(['image']),
    width: 800,
    height: 600,
  },
});
describe('generator export payload validation', () => {
  it('accepts raster and SVG artifacts', () => {
    expect(isGeneratorExportArtifact(artifact())).toBe(true);
    expect(
      isGeneratorExportArtifact({
        ...artifact(),
        payload: {
          kind: 'svg-master',
          mimeType: 'image/svg+xml',
          blob: new Blob(['svg']),
        },
      }),
    ).toBe(true);
  });
  it.each([
    null,
    1,
    {},
    { ...artifact(), exportId: '../escape' },
    { ...artifact(), source: 'unknown' },
    { ...artifact(), payload: null },
    ...[
      { blob: {} },
      { mimeType: 'text/html' },
      { kind: 'other' },
      { mimeType: 'image/svg+xml' },
      { kind: 'svg-master' },
      { width: undefined },
      { height: 0 },
      { width: -1 },
      { width: Infinity },
      { height: '600' },
      { width: 32769 },
    ].map((change) => ({
      ...artifact(),
      payload: { ...artifact().payload, ...change },
    })),
  ])('rejects malformed artifact %#', (value) => {
    expect(isGeneratorExportArtifact(value)).toBe(false);
  });
});
