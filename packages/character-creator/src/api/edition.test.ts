import { describe, expect, it } from 'vitest';
import { resolveRequestedEdition } from './edition';

describe('resolveRequestedEdition', () => {
  it('defaults to 2024', () => {
    expect(resolveRequestedEdition('')).toBe('2024');
    expect(resolveRequestedEdition('?foo=bar')).toBe('2024');
  });

  it('opens 2014 only for an explicit edition=2014', () => {
    expect(resolveRequestedEdition('?edition=2014')).toBe('2014');
    expect(resolveRequestedEdition('?a=1&edition=2014')).toBe('2014');
    expect(resolveRequestedEdition('edition=2014')).toBe('2014');
  });

  it('treats 2024 and unknown values as 2024', () => {
    expect(resolveRequestedEdition('?edition=2024')).toBe('2024');
    expect(resolveRequestedEdition('?edition=2012')).toBe('2024');
    expect(resolveRequestedEdition('?edition=')).toBe('2024');
  });
});
