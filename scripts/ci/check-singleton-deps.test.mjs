import { describe, expect, test } from 'vitest';

import { checkSingletonDeps, collectVersions, findDuplicateVersions } from './check-singleton-deps.mjs';

const lock = (packages) => ({ packages });

describe('check-singleton-deps', () => {
  test('passes when pdfjs-dist resolves to one version', () => {
    expect(findDuplicateVersions(lock({ 'node_modules/pdfjs-dist': { version: '6.3.289' } }))).toEqual([]);
  });

  test('ignores similarly named packages such as @types/pdfjs-dist', () => {
    const packages = {
      'node_modules/pdfjs-dist': { version: '6.3.289' },
      'node_modules/@types/pdfjs-dist': { version: '2.10.378' },
    };
    expect(findDuplicateVersions(lock(packages))).toEqual([]);
  });

  test('fails with the owning paths when a nested copy has another version', () => {
    const packages = {
      'node_modules/pdfjs-dist': { version: '6.3.289' },
      'node_modules/pdf-parse/node_modules/pdfjs-dist': { version: '5.4.296' },
    };
    const failures = findDuplicateVersions(lock(packages));
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('pdfjs-dist resolves to 2 versions');
    expect(failures[0]).toContain('5.4.296: node_modules/pdf-parse/node_modules/pdfjs-dist');
  });

  test('two paths with the same version are fine', () => {
    const packages = {
      'node_modules/pdfjs-dist': { version: '6.3.289' },
      'apps/x/node_modules/pdfjs-dist': { version: '6.3.289' },
    };
    expect(findDuplicateVersions(lock(packages))).toEqual([]);
    expect(collectVersions(lock(packages)).get('pdfjs-dist').get('6.3.289')).toHaveLength(2);
  });

  test('the repository lockfile resolves every singleton once', () => {
    expect(checkSingletonDeps()).toEqual([]);
  });
});
