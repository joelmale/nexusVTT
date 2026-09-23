export interface DiceThemeOption {
  id: string;
  name: string;
}

// Curated dice-box-threejs colorset ids. The engine throws during initialize()
// when passed an unknown colorset, so every persisted or event-provided value
// must pass through normalizeDiceTheme before it reaches DiceBox.
export const DICE_THEMES: DiceThemeOption[] = [
  { id: 'white', name: 'Default' },
  { id: 'black', name: 'Black' },
  { id: 'bronze', name: 'Bronze' },
  { id: 'dragons', name: 'Dragons' },
  { id: 'fire', name: 'Fire' },
  { id: 'ice', name: 'Ice' },
  { id: 'poison', name: 'Poison' },
  { id: 'astralsea', name: 'Astral Sea' },
  { id: 'rainbow', name: 'Rainbow' },
];

export const DEFAULT_DICE_THEME = 'white';

const DICE_THEME_IDS = new Set(DICE_THEMES.map((theme) => theme.id));

export function normalizeDiceTheme(theme: string | null | undefined): string {
  if (!theme) {
    return DEFAULT_DICE_THEME;
  }

  return DICE_THEME_IDS.has(theme) ? theme : DEFAULT_DICE_THEME;
}

export function getStoredDiceTheme(storage: Storage = localStorage): string {
  try {
    const theme = normalizeDiceTheme(storage.getItem('nexus_dice_theme'));
    if (theme !== storage.getItem('nexus_dice_theme')) {
      storage.setItem('nexus_dice_theme', theme);
    }
    return theme;
  } catch {
    return DEFAULT_DICE_THEME;
  }
}
