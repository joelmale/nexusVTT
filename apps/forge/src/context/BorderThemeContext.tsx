import { createContext, useContext } from 'react';
import { BorderTheme, BorderThemes } from '../boarders/BorderThemeUtils';

export interface BorderThemeContextType {
  theme: BorderTheme;
  currentTheme: keyof typeof BorderThemes;
  applyTheme: (themeName: keyof typeof BorderThemes) => void;
  customize: (updates: Partial<BorderTheme>) => void;
  reset: () => void;
  themes: string[];
}

export const BorderThemeContext = createContext<BorderThemeContextType | null>(null);

export const useBorderThemeContext = () => {
  const context = useContext(BorderThemeContext);
  if (!context) {
    throw new Error('useBorderThemeContext must be used within BorderThemeProvider');
  }
  return context;
};
