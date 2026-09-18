import { describe, it, expect } from 'vitest';
import { defaultColorSchemes, getColorSchemeById, validateColorScheme, generateRandomColorScheme, normalizeColorScheme, applyColorScheme } from '../../../src/utils/colorSchemes';

describe('colorSchemes', () => {
  it('should have all required color schemes', () => {
    expect(defaultColorSchemes).toBeInstanceOf(Array);
    expect(defaultColorSchemes.length).toBeGreaterThan(0);

    // Check that we have some specific schemes
    const schemeIds = defaultColorSchemes.map(scheme => scheme.id);
    expect(schemeIds).toContain('nexus-default');
    expect(schemeIds).toContain('emerald-depths');
    expect(schemeIds).toContain('crimson-flame');
    expect(schemeIds).toContain('royal-purple');
  });

  it('should have consistent structure for all schemes', () => {
    defaultColorSchemes.forEach((scheme) => {
      expect(scheme).toHaveProperty('id');
      expect(scheme).toHaveProperty('name');
      expect(scheme).toHaveProperty('primary');
      expect(scheme).toHaveProperty('secondary');
      expect(scheme).toHaveProperty('accent');
      expect(scheme).toHaveProperty('surface');
      expect(scheme).toHaveProperty('text');

      // Check types
      expect(typeof scheme.id).toBe('string');
      expect(typeof scheme.name).toBe('string');
      expect(typeof scheme.primary).toBe('string');
      expect(typeof scheme.secondary).toBe('string');
      expect(typeof scheme.accent).toBe('string');
      expect(typeof scheme.surface).toBe('string');
      expect(typeof scheme.text).toBe('string');
    });
  });

  it('should return valid color scheme', () => {
    const emeraldDepths = getColorSchemeById('emerald-depths');
    expect(emeraldDepths).toBeDefined();
    expect(emeraldDepths?.id).toBe('emerald-depths');
    expect(emeraldDepths?.name).toBe('Emerald Depths');
  });

  it('should fallback to undefined for invalid name', () => {
    const fallback = getColorSchemeById('invalid');
    expect(fallback).toBeUndefined();
  });

  it('should have valid CSS color values', () => {
    defaultColorSchemes.forEach((scheme) => {
      // Check that colors are valid hex values
      const hexColorPattern = /^#[0-9a-fA-F]{6}$/;

      expect(scheme.primary).toMatch(hexColorPattern);
      expect(scheme.secondary).toMatch(hexColorPattern);
      expect(scheme.accent).toMatch(hexColorPattern);
      expect(scheme.surface).toMatch(hexColorPattern);
      expect(scheme.text).toMatch(hexColorPattern);
    });
  });

  it('should validate color schemes correctly', () => {
    const validScheme = defaultColorSchemes[0];
    expect(validateColorScheme(validScheme)).toBe(true);

    const invalidScheme = {
      id: 'test',
      name: 'Test',
      primary: '#000000',
      // missing required fields
    };
    expect(validateColorScheme(invalidScheme)).toBe(false);
  });

  it('should generate random color schemes', () => {
    const randomScheme = generateRandomColorScheme();
    expect(validateColorScheme(randomScheme)).toBe(true);
    expect(randomScheme.id).toMatch(/^random-\d+$/);
    expect(randomScheme.name).toMatch(/^Random Palette \d+$/);
  });
});

describe('normalizeColorScheme', () => {
  // settings.colorScheme is a whole object persisted to localStorage, so a
  // browser holding settings from an older build can supply a scheme missing
  // the fields the CSS variables are derived from. applyColorScheme runs
  // inside a mount effect, so an unguarded field used to take down the app.
  const fallback = defaultColorSchemes[0];

  it('passes a well-formed scheme through unchanged', () => {
    expect(normalizeColorScheme(defaultColorSchemes[2])).toEqual(
      defaultColorSchemes[2],
    );
  });

  it('fills a missing colour field from the default scheme', () => {
    const withoutSurface = { ...defaultColorSchemes[1] } as Partial<
      typeof fallback
    >;
    delete withoutSurface.surface;
    const normalized = normalizeColorScheme(withoutSurface);

    expect(normalized.surface).toBe(fallback.surface);
    expect(normalized.primary).toBe(defaultColorSchemes[1].primary);
  });

  it('replaces a non-hex colour value rather than trusting it', () => {
    const normalized = normalizeColorScheme({
      ...defaultColorSchemes[0],
      primary: 'rebeccapurple',
    });

    expect(normalized.primary).toBe(fallback.primary);
  });

  it('returns the default scheme for null, undefined and junk input', () => {
    expect(normalizeColorScheme(null)).toEqual(fallback);
    expect(normalizeColorScheme(undefined)).toEqual(fallback);
    expect(
      normalizeColorScheme({ nonsense: true } as unknown as typeof fallback),
    ).toEqual(fallback);
  });

  it('keeps applyColorScheme from throwing on a malformed scheme', () => {
    expect(() =>
      applyColorScheme({ id: 'stale' } as unknown as typeof fallback, 'dark'),
    ).not.toThrow();
    expect(
      document.documentElement.style.getPropertyValue('--color-surface'),
    ).toBe(fallback.surface);
  });
});
