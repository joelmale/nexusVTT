import { describe, expect, it } from 'vitest';
import { loadFeats } from '../services/dataService';
import {
  isCoreSrdContent,
  isPermittedContentSource,
} from './contentProvenance';

describe('source provenance and scoped SRD aliases', () => {
  it('keeps legacy supplemental feats out of the published Origin category and preserves their publication years', () => {
    const feats = loadFeats();
    expect(
      feats
        .filter((feat) => feat.category === 'origin')
        .map((feat) => feat.slug)
        .sort(),
    ).toEqual([
      'alert',
      'crafter',
      'healer',
      'lucky',
      'magic-initiate',
      'musician',
      'savage-attacker',
      'skilled',
      'tavern-brawler',
      'tough',
    ]);
    expect(feats.find((feat) => feat.slug === 'dragon-fear')).toMatchObject({
      category: 'general',
      source: 'XGtE',
      year: 2017,
    });
    expect(
      feats.find((feat) => feat.slug === 'gift-of-the-chromatic-dragon'),
    ).toMatchObject({ category: 'general', source: 'FToD', year: 2021 });
  });
  it('permits verified core options without granting every option from their book', () => {
    expect(
      isPermittedContentSource(
        'background',
        'soldier-2024',
        '2024',
        'PHB 2024',
        ['SRD 2024'],
      ),
    ).toBe(true);
    expect(
      isPermittedContentSource(
        'background',
        'soldier-2014',
        '2014',
        'PHB 2014',
        ['SRD 2014'],
      ),
    ).toBe(false);
    expect(
      isPermittedContentSource(
        'background',
        'acolyte-2014',
        '2014',
        'PHB 2014',
        ['SRD 2014'],
      ),
    ).toBe(true);
    expect(
      isPermittedContentSource(
        'background',
        'charlatan-2024',
        '2024',
        'PHB 2024',
        ['SRD 2024'],
      ),
    ).toBe(false);
  });
  it('does not let a parent SRD species authorize supplemental variants', () => {
    expect(
      isPermittedContentSource(
        'species',
        'elf',
        '2014',
        'SRD 2014',
        ['SRD 2014'],
        'high-elf',
      ),
    ).toBe(true);
    expect(
      isPermittedContentSource(
        'species',
        'elf',
        '2014',
        'SRD 2014',
        ['SRD 2014'],
        'wood-elf',
      ),
    ).toBe(false);
    expect(
      isPermittedContentSource(
        'species',
        'elf',
        '2014',
        'SRD 2014',
        ['PHB 2014'],
        'wood-elf',
      ),
    ).toBe(true);
    expect(
      isPermittedContentSource(
        'species',
        'human',
        '2014',
        'SRD 2014',
        ['SRD 2014'],
        'variant',
      ),
    ).toBe(false);
    expect(
      isPermittedContentSource(
        'species',
        'human',
        '2014',
        'SRD 2014',
        ['PHB 2014'],
        'unknown',
      ),
    ).toBe(false);
  });
  it('blocks unverified Artificer even if its placeholder label is included in a strict source list', () => {
    expect(isCoreSrdContent('class', 'artificer', '2024')).toBe(false);
    expect(
      isPermittedContentSource(
        'class',
        'artificer',
        '2024',
        'Unverified supplemental 2024',
        ['Unverified supplemental 2024'],
      ),
    ).toBe(false);
  });
  it('does not convert a legacy feat definition into a revised SRD definition', () => {
    expect(
      isPermittedContentSource('feat', 'grappler', '2024', 'PHB 2014', [
        'SRD 2024',
      ]),
    ).toBe(false);
    expect(isCoreSrdContent('feat', 'tough', '2014')).toBe(false);
    expect(isCoreSrdContent('feat', 'tough', '2024')).toBe(false);
    expect(isCoreSrdContent('subclass', 'unknown', '2014')).toBe(false);
    expect(isCoreSrdContent('species', 'unknown', '2024')).toBe(false);
  });
});
