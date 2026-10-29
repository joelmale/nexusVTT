export type CampaignMood =
  | 'parchment'
  | 'grimdark'
  | 'feywild'
  | 'arcane-night'
  | 'dark-mode';

export interface MoodOption {
  id: CampaignMood;
  label: string;
  tagline: string;
  description: string;
  accentColor: string;
  surfaceColor: string;
  canvasColor: string;
  isDark: boolean;
}

export const CAMPAIGN_MOODS: MoodOption[] = [
  {
    id: 'parchment',
    label: 'Parchment',
    tagline: 'Classic & Scholarly',
    description: 'Warm paper, Fraunces serif typography, and rich leather-bound tome warmth.',
    accentColor: '#b08a3e',
    surfaceColor: '#fbfaf7',
    canvasColor: '#eeeae2',
    isDark: false,
  },
  {
    id: 'grimdark',
    label: 'Grimdark',
    tagline: 'Ash, Rust & Shadow',
    description: 'Desaturated charcoal hues, dried rust accents, and high-contrast dungeon peril.',
    accentColor: '#a83832',
    surfaceColor: '#171a1b',
    canvasColor: '#101213',
    isDark: true,
  },
  {
    id: 'feywild',
    label: 'Feywild',
    tagline: 'Lush & Twilight Verdurous',
    description: 'Mystic pine shadows, shimmering emerald foliage, and ethereal violet undertones.',
    accentColor: '#2fa668',
    surfaceColor: '#131e18',
    canvasColor: '#0b130f',
    isDark: true,
  },
  {
    id: 'arcane-night',
    label: 'Arcane Night',
    tagline: 'Celestial & Runic',
    description: 'Deep cosmic starlight indigo, runic cyan glow, and arcane mystery.',
    accentColor: '#06b6d4',
    surfaceColor: '#121829',
    canvasColor: '#0a0d18',
    isDark: true,
  },
  {
    id: 'dark-mode',
    label: 'Obsidian Dark',
    tagline: 'Sleek & Focused',
    description: 'Refined neutral dark theme engineered for late-night running behind the screen.',
    accentColor: '#d7a34f',
    surfaceColor: '#18191b',
    canvasColor: '#101112',
    isDark: true,
  },
];

export const DEFAULT_MOOD: CampaignMood = 'parchment';
export const LOCAL_STORAGE_MOOD_KEY = 'nexus.campaign-studio.mood';

const VALID_MOOD_IDS = new Set<string>(CAMPAIGN_MOODS.map((m) => m.id));

export function isCampaignMood(value: unknown): value is CampaignMood {
  return typeof value === 'string' && VALID_MOOD_IDS.has(value);
}

/**
 * Resolves the effective mood:
 * 1. Local override (if set by the user in this session/browser)
 * 2. Campaign persistent mood
 * 3. Default fallback ('parchment')
 */
export function resolveCampaignMood(
  campaignMood?: string | null,
  localOverride?: string | null,
): CampaignMood {
  if (localOverride && isCampaignMood(localOverride)) {
    return localOverride;
  }
  if (campaignMood && isCampaignMood(campaignMood)) {
    return campaignMood;
  }
  return DEFAULT_MOOD;
}

export function getMoodOption(moodId: string): MoodOption {
  const found = CAMPAIGN_MOODS.find((m) => m.id === moodId);
  return found ?? CAMPAIGN_MOODS[0];
}

export function getMoodStorageKey(campaignId?: string | null): string {
  const trimmed = campaignId?.trim();
  return trimmed
    ? `${LOCAL_STORAGE_MOOD_KEY}:${trimmed}`
    : LOCAL_STORAGE_MOOD_KEY;
}

export function loadLocalMood(campaignId?: string | null): CampaignMood | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const item = window.localStorage.getItem(getMoodStorageKey(campaignId));
    return isCampaignMood(item) ? item : null;
  } catch {
    return null;
  }
}

export function saveLocalMood(
  mood: CampaignMood | null,
  campaignId?: string | null,
): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const key = getMoodStorageKey(campaignId);
    if (mood) {
      window.localStorage.setItem(key, mood);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage quota/access errors
  }
}

export const readStoredMood = loadLocalMood;
export const writeStoredMood = saveLocalMood;

export function applyMoodToDocument(mood: CampaignMood): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-mood', mood);
  const option = getMoodOption(mood);
  document.documentElement.style.colorScheme = option.isDark ? 'dark' : 'light';
}
