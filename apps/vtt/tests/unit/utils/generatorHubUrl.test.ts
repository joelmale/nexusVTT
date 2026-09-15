import { describe, expect, it } from 'vitest';
import { getGeneratorUrl } from '../../../apps/generator-hub/src/generatorUrl';

describe('generator hub asset URLs', () => {
  it('keeps production generator assets inside the generator-hub mount', () => {
    expect(
      getGeneratorUrl(
        'dungeon',
        'https://vtt.example/generator-hub/?generator=dungeon',
      ),
    ).toBe('https://vtt.example/generator-hub/one-page-dungeon/index.html');
  });

  it('resolves generator assets from the root of the standalone dev server', () => {
    expect(
      getGeneratorUrl('cave', 'http://localhost:5174/?generator=cave'),
    ).toBe('http://localhost:5174/cave-generator/index.html');
  });
});
