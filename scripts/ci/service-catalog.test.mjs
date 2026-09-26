import { readFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  appendCatalogGithubOutputs,
  catalogMatrices,
  checkCatalog,
  loadServiceCatalog,
  validateCatalogRepository,
  validateServiceCatalog,
} from './service-catalog.mjs';

const catalog = loadServiceCatalog();

describe('service catalog', () => {
  test('validates the repository catalog and owned files', () => {
    expect(validateServiceCatalog(catalog)).toBe(catalog);
    expect(validateCatalogRepository(catalog).failures).toEqual([]);
    expect(checkCatalog()).toEqual({
      images: 12,
      services: 6,
      targets: 13,
    });
  });

  test('generates complete and affected matrices from one source', () => {
    const all = catalogMatrices(catalog);
    expect(all.allReleaseImages).toHaveLength(12);
    expect(all.releaseImages).toHaveLength(12);
    expect(all.codexDocApi).toBe(true);
    expect(all.codexNodeServices.map((entry) => entry.service)).toEqual([
      'doc-processor',
      'doc-websocket',
      'admin-ui',
      'dm-ui',
    ]);
    expect(all.codexPythonServices.map((entry) => entry.service)).toEqual([
      'ocr-service',
    ]);

    const ocr = catalogMatrices(catalog, ['codex-ocr-service']);
    expect(ocr.releaseImages.map((entry) => entry.name)).toEqual(['codex-ocr']);
    expect(ocr.codexDocApi).toBe(false);
    expect(ocr.codexNodeServices).toEqual([]);
    expect(ocr.codexPythonServices).toHaveLength(1);
  });

  test('writes workflow-ready JSON matrices', () => {
    const outputPath = join(
      mkdtempSync(join(tmpdir(), 'service-catalog-')),
      'github-output.txt',
    );
    appendCatalogGithubOutputs(
      outputPath,
      catalogMatrices(catalog, ['codex-doc-processor']),
    );
    const output = readFileSync(outputPath, 'utf8');
    expect(output).toContain('has_release_images=true');
    expect(output).toContain('has_codex_node=true');
    expect(output).toContain('has_codex_python=false');
    expect(output).toContain('"service":"doc-processor"');
  });

  test('rejects drift-prone metadata', () => {
    const badLane = structuredClone(catalog);
    badLane.targets.vtt.lanes.push('weekend');
    expect(() => validateServiceCatalog(badLane)).toThrow('unknown lane');

    const duplicateRepository = structuredClone(catalog);
    duplicateRepository.targets.forge.releaseImage.repository =
      duplicateRepository.targets.vtt.releaseImage.repository;
    expect(() => validateServiceCatalog(duplicateRepository)).toThrow(
      'duplicate release image repository',
    );

    const wrongProfile = structuredClone(catalog);
    wrongProfile.targets['codex-ocr-service'].service.validation.profile =
      'node';
    expect(() => validateServiceCatalog(wrongProfile)).toThrow(
      'python validation profile',
    );
  });
});
