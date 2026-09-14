// ============================================
// BORDER THEME UTILITIES AND CONSTANTS
// ============================================

import { CornerStyle, EdgeStyle } from './BorderElements';

export interface BorderTheme {
  name: string;
  cornerStyle: CornerStyle;
  edgeStyle: EdgeStyle;
  color: string;
  backgroundColor: string;
  strokeWidth: number;
  cornerSize: number;
  edgeWidth: number;
  shadow?: string;
  glow?: string;
}

export const BorderThemes: Record<string, BorderTheme> = {
  // Fantasy RPG Themes
  medieval: {
    name: 'Medieval',
    cornerStyle: 'ornate',
    edgeStyle: 'double',
    color: '#2c2416',
    backgroundColor: 'rgba(245, 245, 220, 0.1)',
    strokeWidth: 2,
    cornerSize: 50,
    edgeWidth: 10,
    shadow: '2px 2px 8px rgba(0, 0, 0, 0.3)'
  },

  elven: {
    name: 'Elven',
    cornerStyle: 'ornate',
    edgeStyle: 'decorative',
    color: '#2a5434',
    backgroundColor: 'rgba(42, 84, 52, 0.05)',
    strokeWidth: 1.5,
    cornerSize: 60,
    edgeWidth: 12,
    glow: '0 0 10px rgba(42, 84, 52, 0.3)'
  },

  dwarven: {
    name: 'Dwarven',
    cornerStyle: 'cut',
    edgeStyle: 'double',
    color: '#4a4a4a',
    backgroundColor: 'rgba(74, 74, 74, 0.1)',
    strokeWidth: 2.5,
    cornerSize: 45,
    edgeWidth: 15,
    shadow: '3px 3px 10px rgba(0, 0, 0, 0.4)'
  },

  arcane: {
    name: 'Arcane',
    cornerStyle: 'ornate',
    edgeStyle: 'decorative',
    color: '#4a148c',
    backgroundColor: 'rgba(74, 20, 140, 0.05)',
    strokeWidth: 1.5,
    cornerSize: 55,
    edgeWidth: 8,
    glow: '0 0 15px rgba(74, 20, 140, 0.4)'
  },

  infernal: {
    name: 'Infernal',
    cornerStyle: 'cut',
    edgeStyle: 'double',
    color: '#b71c1c',
    backgroundColor: 'rgba(183, 28, 28, 0.05)',
    strokeWidth: 2,
    cornerSize: 40,
    edgeWidth: 12,
    glow: '0 0 12px rgba(183, 28, 28, 0.3)'
  },

  celestial: {
    name: 'Celestial',
    cornerStyle: 'ornate',
    edgeStyle: 'decorative',
    color: '#fdd835',
    backgroundColor: 'rgba(253, 216, 53, 0.05)',
    strokeWidth: 1.5,
    cornerSize: 65,
    edgeWidth: 10,
    glow: '0 0 20px rgba(253, 216, 53, 0.3)'
  },

  draconic: {
    name: 'Draconic',
    cornerStyle: 'cut',
    edgeStyle: 'double',
    color: '#1b5e20',
    backgroundColor: 'rgba(27, 94, 32, 0.05)',
    strokeWidth: 2.5,
    cornerSize: 50,
    edgeWidth: 14,
    shadow: '4px 4px 12px rgba(0, 0, 0, 0.3)'
  },

  modern: {
    name: 'Modern',
    cornerStyle: 'rounded',
    edgeStyle: 'straight',
    color: '#424242',
    backgroundColor: 'rgba(66, 66, 66, 0.05)',
    strokeWidth: 1,
    cornerSize: 8,
    edgeWidth: 2,
    shadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
  }
};

export interface UseBorderThemeOptions {
  theme?: keyof typeof BorderThemes;
  customTheme?: BorderTheme;
}

export const useBorderTheme = (options: UseBorderThemeOptions = {}) => {
  const { theme = 'medieval', customTheme } = options;
  const selectedTheme = customTheme || BorderThemes[theme] || BorderThemes.medieval;

  return {
    theme: selectedTheme,
    themeName: selectedTheme.name,
    isCustom: !!customTheme
  };
};

export const generateCSSVariables = (theme: BorderTheme): Record<string, string> => {
  return {
    '--border-color': theme.color,
    '--border-bg': theme.backgroundColor,
    '--border-stroke': `${theme.strokeWidth}px`,
    '--border-corner-size': `${theme.cornerSize}px`,
    '--border-edge-width': `${theme.edgeWidth}px`,
    '--border-shadow': theme.shadow || 'none',
    '--border-glow': theme.glow || 'none'
  };
};

export const createBorderStyle = (
  theme: BorderTheme,
  width: number,
  height: number
): React.CSSProperties => {
  return {
    position: 'relative' as const,
    width: `${width}px`,
    height: `${height}px`,
    backgroundColor: theme.backgroundColor,
    border: `${theme.strokeWidth}px solid ${theme.color}`,
    borderRadius: theme.cornerStyle === 'rounded' ? `${theme.cornerSize}px` : '0',
    boxShadow: theme.shadow,
    ...generateCSSVariables(theme)
  };
};

export const calculateModifier = (statValue: number): string => {
  const modifier = Math.floor((statValue - 10) / 2);
  return modifier >= 0 ? `+${modifier}` : `${modifier}`;
};

export const getRandomTheme = (): keyof typeof BorderThemes => {
  const themeKeys = Object.keys(BorderThemes) as (keyof typeof BorderThemes)[];
  return themeKeys[Math.floor(Math.random() * themeKeys.length)];
};

export const BorderAnimations = {
  pulse: {
    animation: 'borderPulse 2s ease-in-out infinite'
  },
  glow: {
    animation: 'borderGlow 3s ease-in-out infinite alternate'
  },
  shimmer: {
    animation: 'borderShimmer 4s linear infinite'
  }
};

export const CharacterSheetPresets = {
  standard: {
    width: 800,
    height: 1100,
    theme: 'medieval' as keyof typeof BorderThemes
  },
  compact: {
    width: 600,
    height: 900,
    theme: 'modern' as keyof typeof BorderThemes
  },
  ornate: {
    width: 900,
    height: 1200,
    theme: 'elven' as keyof typeof BorderThemes
  }
};