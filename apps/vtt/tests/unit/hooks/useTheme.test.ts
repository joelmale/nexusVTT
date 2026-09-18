import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { resolveTheme, useThemeSync, useResolvedTheme, THEME_ATTRIBUTE } from '@/hooks/useTheme';
import { useGameStore } from '@/stores/gameStore';
import { defaultColorSchemes } from '@/utils/colorSchemes';

describe('useTheme hook', () => {
  const createMockMatchMedia = (matches = false) =>
    vi.fn().mockImplementation((query: string) => ({
      matches: typeof matches === 'function' ? matches(query) : matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

  beforeEach(() => {
    document.documentElement.removeAttribute(THEME_ATTRIBUTE);
    document.documentElement.style.colorScheme = '';
    window.matchMedia = createMockMatchMedia(false);

    // Reset store settings
    useGameStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        theme: 'auto',
        colorScheme: defaultColorSchemes[0],
      },
    }));
  });

  afterEach(() => {
    window.matchMedia = createMockMatchMedia(false);
  });

  describe('resolveTheme', () => {
    it('returns light when preference is light', () => {
      expect(resolveTheme('light')).toBe('light');
    });

    it('returns dark when preference is dark', () => {
      expect(resolveTheme('dark')).toBe('dark');
    });

    it('returns light when auto and system prefers light', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('light'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      expect(resolveTheme('auto')).toBe('light');
    });

    it('returns dark when auto and system prefers dark', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('dark'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      expect(resolveTheme('auto')).toBe('dark');
    });
  });

  describe('useResolvedTheme', () => {
    it('returns light when theme setting is light', () => {
      useGameStore.setState((state) => ({
        ...state,
        settings: {
          ...state.settings,
          theme: 'light',
        },
      }));

      const { result } = renderHook(() => useResolvedTheme());
      expect(result.current).toBe('light');
    });

    it('returns dark when theme setting is dark', () => {
      useGameStore.setState((state) => ({
        ...state,
        settings: {
          ...state.settings,
          theme: 'dark',
        },
      }));

      const { result } = renderHook(() => useResolvedTheme());
      expect(result.current).toBe('dark');
    });
  });

  describe('useThemeSync', () => {
    it('sets data-theme and colorScheme to light when theme is light', () => {
      useGameStore.setState((state) => ({
        ...state,
        settings: {
          ...state.settings,
          theme: 'light',
        },
      }));

      renderHook(() => useThemeSync());

      expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('light');
      expect(document.documentElement.style.colorScheme).toBe('light');
      expect(document.documentElement.style.getPropertyValue('--solid-bg-primary')).toBe('#ffffff');
      expect(document.documentElement.style.getPropertyValue('--solid-text')).toBe('#0f172a');
      expect(document.documentElement.style.getPropertyValue('--glass-text')).toBe('#0f172a');
    });

    it('sets data-theme and colorScheme to dark when theme is dark', () => {
      useGameStore.setState((state) => ({
        ...state,
        settings: {
          ...state.settings,
          theme: 'dark',
        },
      }));

      renderHook(() => useThemeSync());

      expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
      expect(document.documentElement.style.colorScheme).toBe('dark');
      expect(document.documentElement.style.getPropertyValue('--solid-bg-primary')).toBe(defaultColorSchemes[0].surface);
      expect(document.documentElement.style.getPropertyValue('--solid-text')).toBe(defaultColorSchemes[0].text);
      expect(document.documentElement.style.getPropertyValue('--glass-text')).toBe(defaultColorSchemes[0].text);
    });

    it('updates dynamically when store theme changes from dark to light', () => {
      useGameStore.setState((state) => ({
        ...state,
        settings: {
          ...state.settings,
          theme: 'dark',
        },
      }));

      const { rerender } = renderHook(() => useThemeSync());
      expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('dark');

      act(() => {
        useGameStore.getState().updateSettings({ theme: 'light' });
      });

      rerender();

      expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('light');
      expect(document.documentElement.style.colorScheme).toBe('light');
      expect(document.documentElement.style.getPropertyValue('--solid-bg-primary')).toBe('#ffffff');
    });

    it('dispatches themeChanged event with the resolved theme', () => {
      const listener = vi.fn();
      window.addEventListener('themeChanged', listener);

      useGameStore.setState((state) => ({
        ...state,
        settings: {
          ...state.settings,
          theme: 'light',
        },
      }));

      renderHook(() => useThemeSync());

      expect(listener).toHaveBeenCalled();
      const event = listener.mock.calls[0][0] as CustomEvent;
      expect(event.detail.theme).toBe('light');

      window.removeEventListener('themeChanged', listener);
    });
  });
});
