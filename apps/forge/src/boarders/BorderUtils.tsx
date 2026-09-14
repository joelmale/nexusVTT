import React from 'react';
import { BorderThemes, generateCSSVariables, BorderAnimations, BorderTheme } from './BorderThemeUtils';
import { useBorderThemeManager } from '../hooks/useBorderThemeManager';
import { BorderThemeContext, useBorderThemeContext } from '../context/BorderThemeContext';

// ============================================
// BORDER COMPONENTS
// ============================================

interface BorderThemeProviderProps {
  children: React.ReactNode;
  initialTheme?: keyof typeof BorderThemes;
  customTheme?: Partial<BorderTheme>;
}

export const BorderThemeProvider: React.FC<BorderThemeProviderProps> = ({
  children,
  initialTheme = 'medieval',
  customTheme
}) => {
  const themeHook = useBorderThemeManager({ initialTheme, customTheme });

  return (
    <BorderThemeContext.Provider value={themeHook}>
      <div style={generateCSSVariables(themeHook.theme) as React.CSSProperties}>
        {children}
      </div>
    </BorderThemeContext.Provider>
  );
};

// ============================================
// ANIMATION UTILITIES
// ============================================



// ============================================
// HELPER COMPONENTS
// ============================================

interface AnimatedBorderPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  animation?: keyof typeof BorderAnimations;
}

export const AnimatedBorderPanel: React.FC<AnimatedBorderPanelProps> = ({
  children,
  animation = 'pulse',
}) => {
  const animationStyle = BorderAnimations[animation];

  return (
    <div
      style={{
        ...animationStyle,
        transition: 'all 0.3s ease-out'
      }}
    >
      {children}
    </div>
  );
};

// Theme selector component
export const ThemeSelector: React.FC = () => {
  const { currentTheme, applyTheme, themes } = useBorderThemeContext();

  return (
    <select
      value={currentTheme}
      onChange={(e) => applyTheme(e.target.value as keyof typeof BorderThemes)}
      style={{
        padding: '8px 12px',
        borderRadius: '4px',
        border: '2px solid var(--border-color)',
        backgroundColor: 'var(--border-bg-color)',
        fontSize: '14px',
        fontFamily: 'inherit'
      }}
    >
      {themes.map(theme => (
        <option key={theme} value={theme}>
          {BorderThemes[theme]?.name || theme}
        </option>
      ))}
    </select>
  );
};
