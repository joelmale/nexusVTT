import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  FONT_SIZE_ATTRIBUTE,
  FONT_SIZES,
  useFontSizeSync,
} from '@/hooks/useFontSize';
import { useGameStore } from '@/stores/gameStore';
import type { FontSize } from '@/types/game';

const TOKENS_PATH = resolve(
  __dirname,
  '../../src/styles/design-tokens.css',
);

describe('font size settings and sync', () => {
  afterEach(() => {
    document.documentElement.removeAttribute(FONT_SIZE_ATTRIBUTE);
  });

  describe('FONT_SIZES definitions', () => {
    it('provides exactly 5 selectable font sizes', () => {
      expect(FONT_SIZES).toHaveLength(5);
      const ids = FONT_SIZES.map((f) => f.id);
      expect(ids).toEqual(['xs', 'small', 'medium', 'large', 'xl']);
    });
  });

  describe('useFontSizeSync hook', () => {
    beforeEach(() => {
      document.documentElement.removeAttribute(FONT_SIZE_ATTRIBUTE);
    });

    it.each<FontSize>(['xs', 'small', 'large', 'xl'])(
      'applies data-font-size="%s" on documentElement for non-default sizes',
      (size) => {
        useGameStore.setState({
          settings: {
            ...useGameStore.getState().settings,
            fontSize: size,
          },
        });

        renderHook(() => useFontSizeSync());

        expect(document.documentElement.getAttribute(FONT_SIZE_ATTRIBUTE)).toBe(
          size,
        );
      },
    );

    it('removes data-font-size attribute when fontSize is "medium" (default)', () => {
      document.documentElement.setAttribute(FONT_SIZE_ATTRIBUTE, 'large');

      useGameStore.setState({
        settings: {
          ...useGameStore.getState().settings,
          fontSize: 'medium',
        },
      });

      renderHook(() => useFontSizeSync());

      expect(
        document.documentElement.hasAttribute(FONT_SIZE_ATTRIBUTE),
      ).toBe(false);
    });
  });

  describe('CSS tokens in design-tokens.css', () => {
    const css = readFileSync(TOKENS_PATH, 'utf-8');

    it('declares root font-size scaling rules for all custom sizes', () => {
      expect(css).toContain("html[data-font-size='xs']");
      expect(css).toContain('font-size: 87.5%;');

      expect(css).toContain("html[data-font-size='small']");
      expect(css).toContain('font-size: 93.75%;');

      expect(css).toContain("html[data-font-size='large']");
      expect(css).toContain('font-size: 106.25%;');

      expect(css).toContain("html[data-font-size='xl']");
      expect(css).toContain('font-size: 112.5%;');
    });
  });
});
