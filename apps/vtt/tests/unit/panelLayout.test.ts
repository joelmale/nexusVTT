import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  PANEL_LAYOUT_ATTRIBUTE,
  PANEL_LAYOUT_GEOMETRY,
  isCoarsePointer,
  layoutKeySuffix,
  resolvePanelLayout,
} from '@/hooks/usePanelLayout';
import type { PanelLayout } from '@/types/game';

const TOKENS_PATH = resolve(
  __dirname,
  '../../src/styles/design-tokens.css',
);

/** Set the (pointer: coarse) answer matchMedia gives for this test. */
function stubPointer(coarse: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('pointer: coarse') ? coarse : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe('panel layout', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute(PANEL_LAYOUT_ATTRIBUTE);
  });

  describe('resolvePanelLayout', () => {
    beforeEach(() => stubPointer(false));

    it.each<PanelLayout>(['original', 'compact', 'widescreen'])(
      'passes %s through on a fine pointer',
      (layout) => {
        expect(resolvePanelLayout(layout)).toBe(layout);
      },
    );

    it('falls back to original for compact on a coarse pointer', () => {
      stubPointer(true);
      expect(isCoarsePointer()).toBe(true);
      // Compact shrinks controls below the 44px touch target the rest of the
      // panel chrome honours, so it is mouse-only.
      expect(resolvePanelLayout('compact')).toBe('original');
    });

    it('still allows widescreen on a coarse pointer', () => {
      stubPointer(true);
      expect(resolvePanelLayout('widescreen')).toBe('widescreen');
    });
  });

  describe('layoutKeySuffix', () => {
    it('leaves original on the bare key so existing installs keep geometry', () => {
      expect(layoutKeySuffix('original')).toBe('');
    });

    it('gives the other layouts their own storage slot', () => {
      expect(layoutKeySuffix('compact')).toBe('--compact');
      expect(layoutKeySuffix('widescreen')).toBe('--widescreen');
    });
  });

  describe('geometry stays in step with the CSS tokens', () => {
    const css = readFileSync(TOKENS_PATH, 'utf-8');

    /**
     * Read a custom property out of a block in design-tokens.css.
     *
     * `anchor` is either a selector or, for the Original values, the comment
     * heading they sit under — those live inside the main `:root` block rather
     * than one of their own. Either way the block runs to the next top-level
     * `}`.
     */
    const readToken = (anchor: string, name: string): string | null => {
      const start = css.indexOf(anchor);
      if (start === -1) return null;
      const block = css.slice(start, css.indexOf('\n}', start));
      const match = block.match(new RegExp(`${name}:\\s*([^;]+);`));
      return match ? match[1].trim() : null;
    };

    const SELECTORS: Record<PanelLayout, string> = {
      // The Original values live in the bare :root block, right after the
      // breakpoint tokens; anchor on the density comment so the lookup does not
      // pick up an earlier :root rule.
      original: 'PANEL DENSITY',
      compact: ":root[data-panel-layout='compact']",
      widescreen: ":root[data-panel-layout='widescreen']",
    };

    it.each<PanelLayout>(['original', 'compact', 'widescreen'])(
      '%s panel width and dock sizes match',
      (layout) => {
        const geometry = PANEL_LAYOUT_GEOMETRY[layout];
        const selector = SELECTORS[layout];

        // Widescreen and compact only redeclare what they change; anything they
        // omit inherits the Original value, which is what the JS records too.
        const width = readToken(selector, '--panel-default-w');
        const side = readToken(selector, '--dock-size-side');
        const bottom = readToken(selector, '--dock-size-bottom');

        if (width) expect(width).toBe(`${geometry.defaultWidth}px`);
        if (side) expect(side).toBe(`${geometry.dockSide}px`);
        if (bottom) expect(bottom).toBe(`${geometry.dockBottom}px`);
      },
    );

    it('declares a token block for every layout', () => {
      expect(css).toContain(":root[data-panel-layout='compact']");
      expect(css).toContain(":root[data-panel-layout='widescreen']");
    });
  });
});
