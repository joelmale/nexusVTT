import { describe, expect, it } from 'vitest';
import {
  isAssetMetadata,
  parseAssetCategoryResult,
  parseAssetManifest,
} from '../../../shared/types';
import { parseTransportEnvelope } from '../../../shared/transport';

const asset = {
  id: 'map-1',
  name: 'Dungeon Map',
  category: 'maps',
  tags: ['dungeon'],
  thumbnail: 'maps/map-1-thumb.webp',
  fullImage: 'maps/map-1.webp',
  dimensions: { width: 1024, height: 768 },
  fileSize: 42_000,
  format: 'webp',
} as const;

describe('shared runtime contracts', () => {
  it('accepts a valid asset manifest and category response', () => {
    expect(isAssetMetadata(asset)).toBe(true);
    expect(
      parseAssetManifest({
        version: '1',
        generatedAt: '2026-07-18T00:00:00.000Z',
        totalAssets: 1,
        categories: ['maps'],
        assets: [asset],
      }).assets,
    ).toHaveLength(1);
    expect(
      parseAssetCategoryResult({
        category: 'maps',
        page: 1,
        limit: 20,
        assets: [asset],
        hasMore: false,
        total: 1,
      }).category,
    ).toBe('maps');
  });

  it('rejects malformed asset data', () => {
    expect(() =>
      parseAssetManifest({
        version: '1',
        generatedAt: 'today',
        totalAssets: 1,
        categories: ['maps'],
        assets: [{ ...asset, dimensions: null }],
      }),
    ).toThrow(TypeError);
  });

  it('validates transport type and type-specific payloads', () => {
    const allowedTypes = new Set(['event', 'heartbeat']);
    expect(
      parseTransportEnvelope(
        {
          type: 'event',
          data: { name: 'scene/update' },
          timestamp: 1,
        },
        allowedTypes,
      ).type,
    ).toBe('event');
    expect(() =>
      parseTransportEnvelope(
        { type: 'heartbeat', data: { id: '1', type: 'invalid' }, timestamp: 1 },
        allowedTypes,
      ),
    ).toThrow(TypeError);
    expect(() =>
      parseTransportEnvelope(
        { type: 'unknown', data: {}, timestamp: 1 },
        allowedTypes,
      ),
    ).toThrow(TypeError);
  });
});
