import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Vite PWA Configuration', () => {
  const viteConfigPath = path.resolve(__dirname, '../../vite.config.ts');

  it('should exist', () => {
    expect(fs.existsSync(viteConfigPath)).toBe(true);
  });

  it('should exclude all map generators from navigateFallbackDenylist', () => {
    const content = fs.readFileSync(viteConfigPath, 'utf-8');

    const expectedDenylists = [
      '/^\\/cave-generator/',
      '/^\\/city-generator/',
      '/^\\/dwellings-generator/',
      '/^\\/one-page-dungeon/',
      '/^\\/world-map-generator/',
    ];

    expectedDenylists.forEach((pattern) => {
      expect(content).toContain(pattern);
    });
  });

  it('should ignore all map generators in globIgnores', () => {
    const content = fs.readFileSync(viteConfigPath, 'utf-8');

    const expectedIgnores = [
      '**/cave-generator/**',
      '**/city-generator/**',
      '**/dwellings-generator/**',
      '**/one-page-dungeon/**',
      '**/world-map-generator/**',
    ];

    expectedIgnores.forEach((pattern) => {
      expect(content).toContain(pattern);
    });
  });
});
