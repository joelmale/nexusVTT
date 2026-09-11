import { describe, it, expect } from 'vitest';
import { defaultColorSchemes, getColorSchemeById, validateColorScheme, generateRandomColorScheme } from '../../../src/utils/colorSchemes';

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