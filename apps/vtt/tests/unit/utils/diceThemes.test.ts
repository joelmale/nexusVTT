import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_DICE_THEME,
  getStoredDiceTheme,
  normalizeDiceTheme,
} from '@/utils/diceThemes';

describe('dice theme normalization', () => {
  it('keeps known dice-box-threejs colorset ids', () => {
    expect(normalizeDiceTheme('bronze')).toBe('bronze');
    expect(normalizeDiceTheme('astralsea')).toBe('astralsea');
  });

  it('falls back when browser storage contains an old dice theme id', () => {
    expect(normalizeDiceTheme('smooth')).toBe(DEFAULT_DICE_THEME);
    expect(normalizeDiceTheme(null)).toBe(DEFAULT_DICE_THEME);
  });

  it('repairs an invalid persisted value before DiceBox reads it', () => {
    const storage = {
      getItem: vi.fn(() => 'smooth'),
      setItem: vi.fn(),
    } as unknown as Storage;

    expect(getStoredDiceTheme(storage)).toBe(DEFAULT_DICE_THEME);
    expect(storage.setItem).toHaveBeenCalledWith(
      'nexus_dice_theme',
      DEFAULT_DICE_THEME,
    );
  });
});
