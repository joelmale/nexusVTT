import { describe, expect, it } from 'vitest';
import { resolveCreatorTheme } from './theme';

describe('resolveCreatorTheme', () => {
  it('defaults to parchment', () => {
    expect(resolveCreatorTheme()).toBe('parchment');
    expect(resolveCreatorTheme(null)).toBe('parchment');
    expect(resolveCreatorTheme('')).toBe('parchment');
  });

  it('folds the older light themes into parchment', () => {
    expect(resolveCreatorTheme('light')).toBe('parchment');
    expect(resolveCreatorTheme('paper')).toBe('parchment');
    expect(resolveCreatorTheme('parchment')).toBe('parchment');
  });

  it('maps dark host themes to dark', () => {
    expect(resolveCreatorTheme('dark')).toBe('dark');
    expect(resolveCreatorTheme('dark-colorful')).toBe('dark');
  });

  it('treats unknown names as parchment', () => {
    expect(resolveCreatorTheme('neon')).toBe('parchment');
  });
});
