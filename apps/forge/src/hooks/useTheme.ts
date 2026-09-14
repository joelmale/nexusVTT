import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';

/**
 * Custom hook to consume theme context
 * @returns ThemeContextValue with current theme and setTheme function
 * @throws Error if used outside ThemeProvider
 */
export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
};
