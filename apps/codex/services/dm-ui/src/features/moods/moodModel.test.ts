import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyMoodToDocument,
  CAMPAIGN_MOODS,
  DEFAULT_MOOD,
  getMoodOption,
  isCampaignMood,
  loadLocalMood,
  LOCAL_STORAGE_MOOD_KEY,
  resolveCampaignMood,
  saveLocalMood,
} from './moodModel';

describe('moodModel', () => {
  let values: Map<string, string>;

  beforeEach(() => {
    values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    });
    document.documentElement.removeAttribute('data-mood');
    document.documentElement.style.colorScheme = '';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('declares 5 distinct campaign moods', () => {
    expect(CAMPAIGN_MOODS).toHaveLength(5);
    const ids = CAMPAIGN_MOODS.map((m) => m.id);
    expect(ids).toEqual(['parchment', 'grimdark', 'feywild', 'arcane-night', 'dark-mode']);
  });

  describe('isCampaignMood', () => {
    it('returns true for all valid mood identifiers', () => {
      expect(isCampaignMood('parchment')).toBe(true);
      expect(isCampaignMood('grimdark')).toBe(true);
      expect(isCampaignMood('feywild')).toBe(true);
      expect(isCampaignMood('arcane-night')).toBe(true);
      expect(isCampaignMood('dark-mode')).toBe(true);
    });

    it('returns false for invalid inputs or nullish types', () => {
      expect(isCampaignMood('cyberpunk')).toBe(false);
      expect(isCampaignMood('')).toBe(false);
      expect(isCampaignMood(null)).toBe(false);
      expect(isCampaignMood(undefined)).toBe(false);
      expect(isCampaignMood(123)).toBe(false);
    });
  });

  describe('resolveCampaignMood', () => {
    it('prioritizes localOverride when valid', () => {
      expect(resolveCampaignMood('grimdark', 'arcane-night')).toBe('arcane-night');
    });

    it('falls back to campaignMood when localOverride is absent or invalid', () => {
      expect(resolveCampaignMood('feywild', null)).toBe('feywild');
      expect(resolveCampaignMood('feywild', 'invalid-mood')).toBe('feywild');
    });

    it('falls back to DEFAULT_MOOD when both are absent or invalid', () => {
      expect(resolveCampaignMood(null, null)).toBe(DEFAULT_MOOD);
      expect(resolveCampaignMood('unknown', 'unknown')).toBe(DEFAULT_MOOD);
    });
  });

  describe('getMoodOption', () => {
    it('retrieves the option for a valid mood', () => {
      const option = getMoodOption('grimdark');
      expect(option.label).toBe('Grimdark');
      expect(option.isDark).toBe(true);
      expect(option.accentColor).toBe('#a83832');
    });

    it('returns parchment as default when given unknown mood id', () => {
      const option = getMoodOption('non-existent');
      expect(option.id).toBe('parchment');
      expect(option.label).toBe('Parchment');
      expect(option.isDark).toBe(false);
    });
  });

  describe('local storage persistence', () => {
    it('saves and loads a mood from localStorage', () => {
      expect(loadLocalMood()).toBeNull();
      saveLocalMood('feywild');
      expect(values.get(LOCAL_STORAGE_MOOD_KEY)).toBe('feywild');
      expect(loadLocalMood()).toBe('feywild');
    });

    it('clears mood from localStorage when passed null', () => {
      saveLocalMood('arcane-night');
      expect(loadLocalMood()).toBe('arcane-night');
      saveLocalMood(null);
      expect(loadLocalMood()).toBeNull();
      expect(values.get(LOCAL_STORAGE_MOOD_KEY)).toBeUndefined();
    });

    it('safely handles localStorage errors without throwing', () => {
      vi.stubGlobal('localStorage', {
        getItem: () => {
          throw new Error('Access denied');
        },
        setItem: () => {
          throw new Error('Quota exceeded');
        },
        removeItem: () => {},
        clear: () => {},
      });
      expect(loadLocalMood()).toBeNull();
      expect(() => saveLocalMood('dark-mode')).not.toThrow();
    });
  });

  describe('applyMoodToDocument', () => {
    it('sets data-mood and color-scheme on documentElement', () => {
      applyMoodToDocument('grimdark');
      expect(document.documentElement.getAttribute('data-mood')).toBe('grimdark');
      expect(document.documentElement.style.colorScheme).toBe('dark');

      applyMoodToDocument('parchment');
      expect(document.documentElement.getAttribute('data-mood')).toBe('parchment');
      expect(document.documentElement.style.colorScheme).toBe('light');
    });
  });
});
