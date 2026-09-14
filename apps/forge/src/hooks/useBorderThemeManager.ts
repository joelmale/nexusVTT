import { useState, useMemo } from 'react';
import { BorderTheme, BorderThemes } from '../boarders/BorderThemeUtils';

interface UseBorderThemeOptions {
  initialTheme?: keyof typeof BorderThemes;
  customTheme?: Partial<BorderTheme>;
  responsive?: boolean;
}

export const useBorderThemeManager = (options: UseBorderThemeOptions = {}) => {
  const { initialTheme = 'medieval', customTheme } = options;
  const [currentTheme, setCurrentTheme] = useState<keyof typeof BorderThemes>(initialTheme);
  const [customizations, setCustomizations] = useState<Partial<BorderTheme>>(customTheme || {});

  const theme = useMemo(() => {
    const baseTheme = BorderThemes[currentTheme] || BorderThemes.medieval;
    return { ...baseTheme, ...customizations };
  }, [currentTheme, customizations]);

  const applyTheme = (themeName: keyof typeof BorderThemes) => {
    setCurrentTheme(themeName);
  };

  const customize = (updates: Partial<BorderTheme>) => {
    setCustomizations(prev => ({ ...prev, ...updates }));
  };

  const reset = () => {
    setCurrentTheme(initialTheme);
    setCustomizations(customTheme || {});
  };

  return {
    theme,
    currentTheme,
    applyTheme,
    customize,
    reset,
    themes: Object.keys(BorderThemes)
  };
};
