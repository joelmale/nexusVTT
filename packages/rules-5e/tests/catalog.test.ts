import { describe, it, expect } from 'vitest';
import {
  normalizeSlug,
  createCatalogKey,
  parseCatalogKey,
} from '../src';

describe('Catalog Key & Slug Normalization', () => {
  it('normalizes arbitrary titles into clean URL-safe slugs', () => {
    expect(normalizeSlug('Magic Missile')).toBe('magic-missile');
    expect(normalizeSlug('  Hold Person (2024 Revision) ')).toBe('hold-person-2024-revision');
    expect(normalizeSlug('Tasha\'s Hideous Laughter')).toBe('tasha-s-hideous-laughter');
  });

  it('generates deterministic, edition-aware catalog keys', () => {
    const key = createCatalogKey('Magic Missile', 'srd-5.2.1', '2024');
    expect(key).toBe('dnd5e:2024:srd-5.2.1:magic-missile');
  });

  it('parses valid catalog keys and rejects malformed keys', () => {
    const parsed = parseCatalogKey('dnd5e:2024:srd-5.2.1:fireball');
    expect(parsed).toEqual({
      system: 'dnd5e',
      edition: '2024',
      contentPackId: 'srd-5.2.1',
      slug: 'fireball',
    });

    expect(parseCatalogKey('invalid:key')).toBeNull();
    expect(parseCatalogKey('dnd5e:1990:pack:fireball')).toBeNull();
  });
});
