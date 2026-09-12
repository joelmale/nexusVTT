// Color scheme utilities for theme management
import type { ColorScheme } from '@/types/game';

// Pre-defined color schemes with hex colors
export const defaultColorSchemes: ColorScheme[] = [
  {
    id: 'nexus-default',
    name: 'Nexus Default',
    primary: '#6366F1',
    secondary: '#8B5CF6',
    accent: '#06B6D4',
    surface: '#1E293B',
    text: '#F8FAFC',
  },
  {
    id: 'emerald-depths',
    name: 'Emerald Depths',
    primary: '#10B981',
    secondary: '#059669',
    accent: '#34D399',
    surface: '#064E3B',
    text: '#ECFDF5',
  },
  {
    id: 'crimson-flame',
    name: 'Crimson Flame',
    primary: '#EF4444',
    secondary: '#DC2626',
    accent: '#F97316',
    surface: '#7F1D1D',
    text: '#FEF2F2',
  },
  {
    id: 'royal-purple',
    name: 'Royal Purple',
    primary: '#7C3AED',
    secondary: '#5B21B6',
    accent: '#A855F7',
    surface: '#581C87',
    text: '#FAF5FF',
  },
  {
    id: 'ocean-breeze',
    name: 'Ocean Breeze',
    primary: '#0284C7',
    secondary: '#0369A1',
    accent: '#38BDF8',
    surface: '#0C4A6E',
    text: '#F0F9FF',
  },
  {
    id: 'golden-sunset',
    name: 'Golden Sunset',
    primary: '#F59E0B',
    secondary: '#D97706',
    accent: '#FBBF24',
    surface: '#92400E',
    text: '#FFFBEB',
  },
  {
    id: 'forest-whisper',
    name: 'Forest Whisper',
    primary: '#22C55E',
    secondary: '#16A34A',
    accent: '#84CC16',
    surface: '#14532D',
    text: '#F0FDF4',
  },
  {
    id: 'midnight-rose',
    name: 'Midnight Rose',
    primary: '#EC4899',
    secondary: '#DB2777',
    accent: '#F472B6',
    surface: '#831843',
    text: '#FDF2F8',
  },
];

/**
 * Generate a random color scheme with coordinated colors (returns hex)
 */
export const generateRandomColorScheme = (): ColorScheme => {
  // Generate a base hue (0-360)
  const baseHue = Math.floor(Math.random() * 360);

  // Create complementary and analogous colors
  const primaryHue = baseHue;
  const secondaryHue = (baseHue + 30) % 360; // Analogous
  const accentHue = (baseHue + 180) % 360; // Complementary

  // Generate saturation and lightness values for harmony
  const baseSaturation = 65 + Math.floor(Math.random() * 25); // 65-90%
  const baseLightness = 45 + Math.floor(Math.random() * 15); // 45-60%

  // Helper function to convert HSL to hex
  const hslToHex = (h: number, s: number, l: number): string => {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color)
        .toString(16)
        .padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
  };

  const colorScheme: ColorScheme = {
    id: `random-${Date.now()}`,
    name: `Random Palette ${Math.floor(Math.random() * 1000)}`,
    primary: hslToHex(primaryHue, baseSaturation, baseLightness),
    secondary: hslToHex(secondaryHue, baseSaturation - 5, baseLightness - 5),
    accent: hslToHex(accentHue, baseSaturation + 5, baseLightness + 10),
    surface: hslToHex(
      primaryHue,
      Math.floor(baseSaturation * 0.3),
      Math.floor(baseLightness * 0.4),
    ),
    text: hslToHex(primaryHue, 15, 95),
  };

  return colorScheme;
};

/**
 * Apply a color scheme to CSS custom properties
 */
export const applyColorScheme = (colorScheme: ColorScheme): void => {
  const root = document.documentElement;

  // Helper function to convert hex to RGB values
  const hexToRgb = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return '255, 255, 255';
    return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
  };

  // Helper function to adjust color brightness
  const adjustBrightness = (hex: string, percent: number): string => {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, Math.max(0, (num >> 16) + amt));
    const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
    const B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
    return (
      '#' +
      (0x1000000 + R * 0x10000 + G * 0x100 + B)
        .toString(16)
        .slice(1)
        .toUpperCase()
    );
  };

  // Apply the main color scheme
  root.style.setProperty('--color-primary', colorScheme.primary);
  root.style.setProperty('--color-secondary', colorScheme.secondary);
  root.style.setProperty('--color-accent', colorScheme.accent);
  root.style.setProperty('--color-surface', colorScheme.surface);
  root.style.setProperty('--color-text', colorScheme.text);

  // Create RGB versions for opacity usage
  root.style.setProperty('--color-primary-rgb', hexToRgb(colorScheme.primary));
  root.style.setProperty(
    '--color-secondary-rgb',
    hexToRgb(colorScheme.secondary),
  );
  root.style.setProperty('--color-accent-rgb', hexToRgb(colorScheme.accent));
  root.style.setProperty('--color-surface-rgb', hexToRgb(colorScheme.surface));
  root.style.setProperty('--color-text-rgb', hexToRgb(colorScheme.text));

  // Create derived colors for solid theme
  // These use the color scheme colors with adjusted brightness
  root.style.setProperty('--solid-bg-primary', colorScheme.surface);
  root.style.setProperty(
    '--solid-bg-secondary',
    adjustBrightness(colorScheme.surface, 10),
  );
  root.style.setProperty(
    '--solid-bg-tertiary',
    adjustBrightness(colorScheme.surface, 20),
  );
  root.style.setProperty(
    '--solid-bg-hover',
    adjustBrightness(colorScheme.surface, 15),
  );
  root.style.setProperty(
    '--solid-bg-active',
    adjustBrightness(colorScheme.surface, 25),
  );
  root.style.setProperty(
    '--solid-border',
    adjustBrightness(colorScheme.surface, 30),
  );
  root.style.setProperty(
    '--solid-border-light',
    adjustBrightness(colorScheme.surface, 40),
  );
  root.style.setProperty('--solid-text', colorScheme.text);
  // Use semi-transparent versions of the main text color for better contrast on solid backgrounds
  root.style.setProperty(
    '--solid-text-muted',
    `rgba(${hexToRgb(colorScheme.text)}, 0.7)`,
  );
  root.style.setProperty(
    '--solid-text-light',
    `rgba(${hexToRgb(colorScheme.text)}, 0.5)`,
  );

  // Update glass surface colors for glassmorphism theme
  const surfaceRgb = hexToRgb(colorScheme.surface);
  const textRgb = hexToRgb(colorScheme.text);
  root.style.setProperty('--glass-surface', `rgba(${surfaceRgb}, 0.1)`);
  root.style.setProperty('--glass-surface-hover', `rgba(${surfaceRgb}, 0.15)`);
  root.style.setProperty('--glass-surface-strong', `rgba(${surfaceRgb}, 0.2)`);
  root.style.setProperty('--glass-border', `rgba(${textRgb}, 0.2)`);
  root.style.setProperty('--glass-text', colorScheme.text);
  // Use semi-transparent white for muted/light text in glass theme for better readability
  root.style.setProperty('--glass-text-muted', 'rgba(255, 255, 255, 0.7)');
  root.style.setProperty('--glass-text-light', 'rgba(255, 255, 255, 0.5)');

  // Update gradients with scheme colors
  root.style.setProperty(
    '--gradient-primary',
    `linear-gradient(135deg, ${colorScheme.primary} 0%, ${colorScheme.secondary} 100%)`,
  );
  root.style.setProperty(
    '--gradient-secondary',
    `linear-gradient(135deg, ${colorScheme.secondary} 0%, ${colorScheme.accent} 100%)`,
  );
  root.style.setProperty(
    '--gradient-tertiary',
    `linear-gradient(135deg, ${colorScheme.accent} 0%, ${colorScheme.primary} 100%)`,
  );
  root.style.setProperty(
    '--gradient-dark',
    `linear-gradient(135deg, ${colorScheme.surface} 0%, ${adjustBrightness(colorScheme.surface, -10)} 100%)`,
  );
};

/**
 * Get a color scheme by ID
 */
export const getColorSchemeById = (id: string): ColorScheme | undefined => {
  return defaultColorSchemes.find((scheme) => scheme.id === id);
};

/**
 * Validate a color scheme object
 */
export const validateColorScheme = (
  colorScheme: Partial<ColorScheme>,
): boolean => {
  const requiredFields = [
    'id',
    'name',
    'primary',
    'secondary',
    'accent',
    'surface',
    'text',
  ];

  for (const field of requiredFields) {
    if (!colorScheme[field as keyof ColorScheme]) {
      return false;
    }
  }

  return true;
};

/**
 * Create a custom color scheme from user input
 */
export const createCustomColorScheme = (
  name: string,
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    surface: string;
    text: string;
  },
): ColorScheme => {
  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: name.trim() || 'Custom Scheme',
    ...colors,
  };
};

/**
 * Generate a palette preview for color scheme selection
 */
export const getColorSchemePreview = (colorScheme: ColorScheme): string[] => {
  return [
    colorScheme.primary,
    colorScheme.secondary,
    colorScheme.accent,
    colorScheme.surface,
    colorScheme.text,
  ];
};

/**
 * Calculate contrast ratio between two colors (simplified)
 */
export const getContrastRatio = (color1: string, color2: string): number => {
  // This is a simplified contrast calculation
  // In a production app, you'd want a more robust implementation
  const getLuminance = (_color: string): number => {
    // Simple luminance approximation
    return 0.5; // Placeholder - would need proper color parsing
  };

  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);

  return (brightest + 0.05) / (darkest + 0.05);
};

/**
 * Check if a color scheme meets accessibility guidelines
 */
export const isAccessible = (colorScheme: ColorScheme): boolean => {
  // Check text contrast against surface
  const textSurfaceContrast = getContrastRatio(
    colorScheme.text,
    colorScheme.surface,
  );
  return textSurfaceContrast >= 4.5; // WCAG AA standard
};
