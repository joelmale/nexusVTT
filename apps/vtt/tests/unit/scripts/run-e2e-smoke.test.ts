import { describe, expect, it } from 'vitest';

import {
  parseCarriedImages,
  validatePrebuiltConfiguration,
} from '../../../scripts/run-e2e-smoke.js';

const sourceSha = 'a'.repeat(40);

function prebuiltEnvironment(overrides: Record<string, string> = {}) {
  return {
    E2E_ASSET_IMAGE: 'nexus-vtt/asset-service:test',
    E2E_BACKEND_IMAGE: 'nexus-vtt/backend:test',
    E2E_EXPECTED_DELTA_SYNC: 'true',
    E2E_FRONTEND_IMAGE: 'nexus-vtt/frontend:test',
    E2E_PREBUILT: '1',
    E2E_SOURCE_SHA: sourceSha,
    ...overrides,
  };
}

describe('managed smoke prebuilt configuration', () => {
  it('requires every exact-run image and source identity', () => {
    expect(validatePrebuiltConfiguration(prebuiltEnvironment())).toEqual([
      { image: 'nexus-vtt/asset-service:test', name: 'asset-service' },
      { image: 'nexus-vtt/backend:test', name: 'backend' },
      { image: 'nexus-vtt/frontend:test', name: 'frontend' },
    ]);
  });

  it.each([
    [{ E2E_SOURCE_SHA: 'short' }, 'E2E_SOURCE_SHA'],
    [{ E2E_EXPECTED_DELTA_SYNC: 'maybe' }, 'E2E_EXPECTED_DELTA_SYNC'],
    [{ E2E_ASSET_IMAGE: '' }, 'E2E_ASSET_IMAGE'],
    [{ E2E_BACKEND_IMAGE: '' }, 'E2E_BACKEND_IMAGE'],
    [{ E2E_FRONTEND_IMAGE: '' }, 'E2E_FRONTEND_IMAGE'],
  ])('fails closed for malformed configuration %j', (override, message) => {
    expect(() =>
      validatePrebuiltConfiguration(prebuiltEnvironment(override)),
    ).toThrow(message);
  });

  it('parses the carried-over image list', () => {
    expect(parseCarriedImages({})).toEqual(new Set());
    expect(
      parseCarriedImages({ E2E_CARRIED_IMAGES: ' asset-service, backend ,' }),
    ).toEqual(new Set(['asset-service', 'backend']));
  });

  it('rejects an unknown carried image name', () => {
    expect(() => parseCarriedImages({ E2E_CARRIED_IMAGES: 'postgres' })).toThrow(
      'E2E_CARRIED_IMAGES',
    );
  });

  it('keeps local build-from-source mode unchanged', () => {
    expect(validatePrebuiltConfiguration({})).toEqual([]);
  });
});
