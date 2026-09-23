import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  PANEL_LAYOUT_ATTRIBUTE,
  PANEL_LAYOUT_GEOMETRY,
  PANEL_DEFAULT_DIMENSIONS,
  getPanelDefaultSize,
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

  describe('getPanelDefaultSize', () => {
    it('defines default dimensions for primary panels', () => {
      expect(PANEL_DEFAULT_DIMENSIONS.settings).toBeDefined();
      expect(PANEL_DEFAULT_DIMENSIONS.dice).toBeDefined();
      expect(PANEL_DEFAULT_DIMENSIONS.chat).toBeDefined();
    });

    it('returns tailored dimensions for key panels', () => {
      const settingsSize = getPanelDefaultSize('settings', 'original');
      expect(settingsSize.width).toBe(500);
      expect(settingsSize.height).toBe(650);

      const diceCompact = getPanelDefaultSize('dice', 'compact');
      expect(diceCompact.width).toBe(340);
      expect(diceCompact.height).toBe(560);

      const chatWidescreen = getPanelDefaultSize('chat', 'widescreen');
      expect(chatWidescreen.width).toBe(540);
      expect(chatWidescreen.height).toBe(720);
    });

    it('falls back to generic geometry for unregistered panel IDs', () => {
      const generic = getPanelDefaultSize('unknown-panel', 'compact');
      expect(generic.width).toBe(PANEL_LAYOUT_GEOMETRY.compact.defaultWidth);
      expect(generic.height).toBe(PANEL_LAYOUT_GEOMETRY.compact.defaultHeight);
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

    it('moves both ladders wholesale in compact', () => {
      // The semantic aliases point at the ladders, so a layout that redeclared
      // only some rungs would leave the aliases inconsistent with each other.
      const compact = css.slice(
        css.indexOf(":root[data-panel-layout='compact']"),
      );
      const block = compact.slice(0, compact.indexOf('\n}'));
      for (let n = 0; n <= 10; n++) {
        expect(block).toContain(`--panel-space-${n}:`);
      }
      for (let n = 0; n <= 9; n++) {
        expect(block).toContain(`--panel-font-${n}:`);
      }
    });
  });

  describe('stylesheet import order', () => {
    const main = readFileSync(
      resolve(__dirname, '../../src/styles/main.css'),
      'utf-8',
    );

    it('imports panel-layouts.css unlayered and last', () => {
      // An unlayered rule beats every layered rule regardless of specificity,
      // so this is the only position from which the widescreen reflow can
      // override both the layered component sheets and unlayered chat.css.
      // Moving it into a layer disables the reflow silently.
      const imports = [...main.matchAll(/@import\s+'([^']+)'([^;]*);/g)].map(
        (m) => ({ file: m[1], layer: m[2].trim() }),
      );

      const panelLayouts = imports.at(-1);
      expect(panelLayouts?.file).toBe('./panel-layouts.css');
      expect(panelLayouts?.layer).toBe('');

      const chat = imports.find((i) => i.file.endsWith('chat.css'));
      expect(chat?.layer).toBe('');
    });
  });

  describe('widescreen reflow', () => {
    const css = readFileSync(
      resolve(__dirname, '../../src/styles/panel-layouts.css'),
      'utf-8',
    );

    it('gates every container query on the widescreen layout', () => {
      // Reflowing whenever a panel happens to be wide would surprise anyone who
      // had simply dragged a panel out in the layout they already had.
      // Every rule in the file, ignoring the @container wrappers themselves.
      const selectors = css
        .split('\n')
        .filter((line) => /^ {2}\S.*\{\s*$/.test(line) && !line.includes('@'))
        .map((line) => line.replaceAll('{', '').trim());
      expect(selectors.length).toBeGreaterThan(0);
      for (const selector of selectors) {
        expect(selector).toContain("[data-panel-layout='widescreen']");
      }
    });

    it('queries the container FloatingPanel declares', () => {
      const module = readFileSync(
        resolve(__dirname, '../../src/components/FloatingPanel.module.css'),
        'utf-8',
      );
      // Floating, docked and popped-out all need the container, or the reflow
      // would apply in one presentation of a panel but not another.
      expect(
        (module.match(/container-name:\s*panel;/g) ?? []).length,
      ).toBe(3);
      expect(css).toContain('@container panel (min-width:');
    });
  });
});
