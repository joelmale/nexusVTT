import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { ThemeType, loadTheme, saveTheme, applyTheme } from '../services/themeService';

interface ThemeContextValue {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeType>(() => loadTheme());

  // Apply theme on mount and when it changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
    saveTheme(newTheme);
    applyTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Export ThemeContext for useTheme hook
export { ThemeContext };
